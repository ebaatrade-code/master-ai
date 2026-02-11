import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import * as admin from "firebase-admin";

type Body = { ref: string };

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// ---- token cache ----
let cachedAccessToken: { token: string; expMs: number } | null = null;

async function getQPayAccessToken(): Promise<string> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const username = envOrThrow("QPAY_USERNAME");
  const password = envOrThrow("QPAY_PASSWORD");

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expMs > now + 30_000) return cachedAccessToken.token;

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

  const data = (await res.json()) as any;
  const token = String(data?.access_token || "").trim();
  if (!token) throw new Error("QPAY auth: access_token missing");

  const expiresSec =
    typeof data.expires_in === "number" && data.expires_in > 0 && data.expires_in < 86400 * 365 ? data.expires_in : 3600;

  cachedAccessToken = { token, expMs: now + expiresSec * 1000 };
  return token;
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

// ✅ QPay payment check (defensive)
async function qpayCheckInvoicePaid(invoiceId: string) {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const accessToken = await getQPayAccessToken();

  // QPay дээр хамгийн түгээмэл ашиглагддаг endpoint:
  // POST /v2/payment/check  { object_type:"INVOICE", object_id:"..." }
  const res = await fetch(`${baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ object_type: "INVOICE", object_id: invoiceId }),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    return { ok: false, paid: false, status: "ERROR", detail: data };
  }

  // Paid гэж үзэх олон хувилбар
  const status =
    String(data?.payment_status || data?.status || data?.invoice_status || "").toUpperCase();

  const paidAmount = Number(data?.paid_amount ?? data?.paidAmount ?? 0);

  // Зарим response "rows" массивтай байдаг
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.payments) ? data.payments : [];
  const anyRowPaid = rows.some((r: any) => String(r?.payment_status || r?.status || "").toUpperCase() === "PAID");

  const paid = status === "PAID" || paidAmount > 0 || anyRowPaid;

  return { ok: true, paid, status: paid ? "PAID" : "PENDING", detail: data };
}

export async function POST(req: NextRequest) {
  try {
    // 1) verify firebase token
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    // 2) body
    const body = (await req.json().catch(() => null)) as Body | null;
    const ref = String(body?.ref || "").trim();
    if (!ref) return jsonError("ref is required", 400);

    const db = adminDb();

    // 3) load qpayPayments doc
    const payRef = db.collection("qpayPayments").doc(ref);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return jsonError("Payment not found", 404);

    const pay = paySnap.data() as any;

    // owner check
    if (String(pay?.uid || "") !== decoded.uid) return jsonError("Forbidden", 403);

    const courseId = String(pay?.courseId || "").trim();
    const invoiceId = String(pay?.qpayInvoiceId || "").trim();
    const amount = Number(pay?.amount ?? 0);

    if (!courseId) return jsonError("courseId missing in payment doc", 400);
    if (!invoiceId) return jsonError("qpayInvoiceId missing in payment doc", 400);

    // already paid
    if (pay?.paid === true || String(pay?.status || "").toLowerCase() === "paid") {
      return NextResponse.json({ ok: true, paid: true, status: "PAID" }, { status: 200 });
    }

    // 4) check qpay
    const check = await qpayCheckInvoicePaid(invoiceId);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, paid: false, status: "ERROR", message: "QPay check failed", detail: check.detail },
        { status: 400 }
      );
    }

    if (!check.paid) {
      // still pending
      await payRef.set(
        { status: "pending", updatedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json({ ok: true, paid: false, status: "PENDING" }, { status: 200 });
    }

    // 5) mark paid + grant course
    // read course duration
    const courseSnap = await db.collection("courses").doc(courseId).get();
    let durationDays = 30;
    let durationLabel = "30 хоног";

    if (courseSnap.exists) {
      const c = courseSnap.data() as any;
      const dd = Number(c?.durationDays);
      if (Number.isFinite(dd) && dd > 0) durationDays = dd;
      else {
        const parsed = parseDurationToDays(c?.durationLabel) ?? parseDurationToDays(c?.duration);
        if (parsed && parsed > 0) durationDays = parsed;
      }
      durationLabel = String(c?.durationLabel || "").trim() || String(c?.duration || "").trim() || `${durationDays} хоног`;
    }

    const nowMs = Date.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + durationDays * 24 * 60 * 60 * 1000);

    // update payment doc
    await payRef.set(
      {
        paid: true,
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
        checkStatus: check.status,
        checkedAt: new Date(),
      },
      { merge: true }
    );

    // update user doc (unlock course)
    const userRef = db.collection("users").doc(decoded.uid);
    await userRef.set({ updatedAt: new Date() }, { merge: true });

    await userRef.set(
      {
        purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
        purchases: {
          [courseId]: {
            purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt,
            durationDays,
            durationLabel,
            amount,
            invoiceRef: ref,
            qpayInvoiceId: invoiceId,
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, paid: true, status: "PAID" }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}