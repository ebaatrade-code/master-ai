// app/api/qpay/checkout/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

type AnyObj = Record<string, any>;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// ---- In-memory token cache (per server instance) ----
let cachedAccessToken: { token: string; expMs: number } | null = null;

type QPayAuthResp = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

async function getQPayAccessToken(): Promise<string> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const username = envOrThrow("QPAY_USERNAME");
  const password = envOrThrow("QPAY_PASSWORD");

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expMs > now + 30_000) {
    return cachedAccessToken.token;
  }

  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QPAY auth failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as QPayAuthResp;
  if (!data?.access_token) throw new Error("QPAY auth: access_token missing");

  const expiresSec =
    typeof data.expires_in === "number" && data.expires_in > 0 && data.expires_in < 86400 * 365
      ? data.expires_in
      : 3600;

  cachedAccessToken = { token: data.access_token, expMs: now + expiresSec * 1000 };
  return data.access_token;
}

// ✅ QPay төлбөр шалгах: POST /v2/payment/check (object_type=INVOICE)
async function qpayCheckInvoicePaid(invoiceId: string): Promise<{
  paid: boolean;
  paidAmount: number;
  raw: AnyObj;
}> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const accessToken = await getQPayAccessToken();

  const body = {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  };

  const res = await fetch(`${baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`QPAY payment/check failed (${res.status}): ${text.slice(0, 500)}`);

  let data: AnyObj = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("QPAY payment/check: invalid JSON");
  }

  const paidAmount = Number(data?.paid_amount ?? 0);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const hasPaidRow = rows.some((r: AnyObj) => String(r?.payment_status || "").toUpperCase() === "PAID");

  return { paid: hasPaidRow && paidAmount > 0, paidAmount, raw: data };
}

function parseDurationToDays(input?: string): number | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;

  const mDays = s.match(/(\d+)\s*(хоног|өдөр)/);
  if (mDays) return Number(mDays[1]);

  const mMonths = s.match(/(\d+)\s*сар/);
  if (mMonths) return Number(mMonths[1]) * 30;

  const mYears = s.match(/(\d+)\s*жил/);
  if (mYears) return Number(mYears[1]) * 365;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded?.uid;
    if (!uid) return jsonError("Invalid token", 401);

    // 2) Body
    const body = (await req.json().catch(() => null)) as { ref?: string } | null;
    const ref = String(body?.ref ?? "").trim();
    if (!ref) return jsonError("ref is required", 400);

    const db = adminDb();

    // 3) Load qpayPayments doc
    const payRef = db.collection("qpayPayments").doc(ref);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return jsonError("Payment doc not found", 404);

    const pay = paySnap.data() as AnyObj;

    // ✅ security: өөр хүний invoice шалгахгүй
    if (String(pay?.uid || "") !== uid) return jsonError("Forbidden", 403);

    const courseId = String(pay?.courseId || "").trim();
    const amount = Number(pay?.amount ?? 0);
    const qpayInvoiceId = String(pay?.qpayInvoiceId || "").trim();

    if (!courseId) return jsonError("Payment doc has no courseId", 400);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("Payment doc has invalid amount", 400);
    if (!qpayInvoiceId) return jsonError("Payment doc has no qpayInvoiceId", 400);

    // 4) If already paid -> ok
    if (pay?.paid === true || String(pay?.status || "").toLowerCase() === "paid") {
      return NextResponse.json({ ok: true, paid: true, status: "PAID" }, { status: 200 });
    }

    // 5) Ask QPay
    const chk = await qpayCheckInvoicePaid(qpayInvoiceId);

    // paidAmount >= amount гэдэг нөхцөлөөр баталгаажуулж болно
    const isPaid = chk.paid && chk.paidAmount >= amount;

    if (!isPaid) {
      // update last checked time (optional)
      await payRef.set(
        { updatedAt: new Date(), lastCheckAt: new Date(), lastPaidAmount: chk.paidAmount, status: "pending" },
        { merge: true }
      );

      return NextResponse.json({ ok: true, paid: false, status: "PENDING", paidAmount: chk.paidAmount }, { status: 200 });
    }

    // 6) Paid -> grant purchase
    // course duration-г course doc-оос уншина
    const courseSnap = await db.collection("courses").doc(courseId).get();
    const c = courseSnap.exists ? (courseSnap.data() as AnyObj) : null;

    let durationDays = 30;
    let durationLabel = "30 хоног";

    const dd = Number(c?.durationDays);
    if (Number.isFinite(dd) && dd > 0) durationDays = dd;
    else {
      const parsed = parseDurationToDays(c?.durationLabel) ?? parseDurationToDays(c?.duration);
      if (parsed && parsed > 0) durationDays = parsed;
    }

    durationLabel =
      String(c?.durationLabel ?? "").trim() ||
      String(c?.duration ?? "").trim() ||
      `${durationDays} хоног`;

    const nowMs = Date.now();
    const expiresAtMs = nowMs + durationDays * 24 * 60 * 60 * 1000;

    // admin firestore timestamp
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FieldValue, Timestamp } = require("firebase-admin/firestore");

    const userRef = db.collection("users").doc(uid);

    // ✅ purchases map DOT PATH + purchasedCourseIds arrayUnion
    await userRef.set(
      {
        purchasedCourseIds: FieldValue.arrayUnion(courseId),
        purchases: {
          [courseId]: {
            purchasedAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(expiresAtMs),
            durationDays,
            durationLabel,
            paymentRef: ref,
            qpayInvoiceId,
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 7) Mark qpayPayments paid
    await payRef.set(
      {
        paid: true,
        status: "paid",
        paidAmount: chk.paidAmount,
        lastCheckAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, paid: true, status: "PAID" }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}