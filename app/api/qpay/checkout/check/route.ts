// FILE: app/api/qpay/checkout/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import * as admin from "firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = { ref: string };

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonError(message: string, status = 400) {
  return noStoreJson({ ok: false, message }, status);
}

function isValidRef(ref: string) {
  return (
    typeof ref === "string" &&
    ref.length >= 6 &&
    ref.length <= 120 &&
    /^[a-zA-Z0-9_.:-]+$/.test(ref)
  );
}

function num(x: unknown) {
  if (typeof x === "number") return x;
  if (typeof x === "string" && x.trim()) return Number(x);
  return NaN;
}

function normalizeMoney(n: any) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 100) / 100;
}

function amountsMatch(a: any, b: any) {
  const x = normalizeMoney(a);
  const y = normalizeMoney(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) < 0.01;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---- token cache ----
let cachedAccessToken: { token: string; expMs: number } | null = null;

async function getQPayAccessToken(): Promise<string> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const username = envOrThrow("QPAY_USERNAME");
  const password = envOrThrow("QPAY_PASSWORD");

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expMs > now + 30_000) {
    return cachedAccessToken.token;
  }

  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetchWithTimeout(
    `${baseUrl}/v2/auth/token`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    },
    15000
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QPAY auth failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json().catch(() => null)) as any;
  const token = String(data?.access_token || "").trim();
  if (!token) throw new Error("QPAY auth: access_token missing");

  const expiresSec =
    typeof data.expires_in === "number" && data.expires_in > 0 && data.expires_in < 86400 * 365
      ? data.expires_in
      : 3600;

  cachedAccessToken = { token, expMs: now + expiresSec * 1000 };
  return token;
}

function parseDurationToDays(input?: string): number | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;

  const rawNum = s.match(/(\d+)/);
  const n = rawNum ? Number(rawNum[1]) : NaN;

  const mDays = s.match(/(\d+)\s*(хоног|өдөр|day)/);
  if (mDays) return Number(mDays[1]);

  const mMonths = s.match(/(\d+)\s*сар/);
  if (mMonths) return Number(mMonths[1]) * 30;

  const mYears = s.match(/(\d+)\s*жил/);
  if (mYears) return Number(mYears[1]) * 365;

  if (Number.isFinite(n) && n > 0) return n;

  return null;
}

// ✅ QPay payment check (defensive)
async function qpayCheckInvoicePaid(invoiceId: string) {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const accessToken = await getQPayAccessToken();

  const res = await fetchWithTimeout(
    `${baseUrl}/v2/payment/check`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ object_type: "INVOICE", object_id: invoiceId }),
    },
    20000
  );

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    return { ok: false, paid: false, status: "ERROR", detail: data, paidAmount: 0 };
  }

  const status = String(
    data?.payment_status || data?.status || data?.invoice_status || ""
  )
    .trim()
    .toUpperCase();

  const paidAmount = Number(data?.paid_amount ?? data?.paidAmount ?? 0);

  const rows = Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data?.payments)
    ? data.payments
    : [];

  const anyRowPaid = rows.some(
    (r: any) =>
      String(r?.payment_status || r?.status || "")
        .trim()
        .toUpperCase() === "PAID"
  );

  const paid = status === "PAID" || paidAmount > 0 || anyRowPaid;

  return {
    ok: true,
    paid,
    status: paid ? "PAID" : "PENDING",
    paidAmount: Number.isFinite(paidAmount) ? paidAmount : 0,
    detail: data,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1) verify firebase token
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    // ✅ revoked token check
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    // 2) body
    const body = (await req.json().catch(() => null)) as Body | null;
    const ref = String(body?.ref || "").trim();
    if (!ref) return jsonError("ref is required", 400);
    if (!isValidRef(ref)) return jsonError("Invalid ref format", 400);

    const db = adminDb();

    // 3) load qpayPayments doc
    const payRef = db.collection("qpayPayments").doc(ref);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return jsonError("Payment not found", 404);

    const pay = paySnap.data() as any;

    // owner check
    if (String(pay?.uid || "") !== decoded.uid) return jsonError("Forbidden", 403);

    // ✅ basic anti-spam rate limit (per ref)
    const nowMs = Date.now();
    const lastAt = (pay?.lastClientCheckAt?.toMillis?.() as number | undefined) ?? 0;
    if (lastAt && nowMs - lastAt < 800) {
      return noStoreJson(
        { ok: false, paid: false, status: "RATE_LIMITED", message: "Too many requests" },
        429
      );
    }

    const courseId = String(pay?.courseId || "").trim();
    const invoiceId = String(pay?.qpayInvoiceId || "").trim();
    const payAmount = normalizeMoney(pay?.amount ?? 0);

    if (!courseId) return jsonError("courseId missing in payment doc", 400);
    if (!invoiceId) return jsonError("qpayInvoiceId missing in payment doc", 400);

    const invRef = db.collection("invoices").doc(ref);

    // ✅ callback route өмнө нь grant хийсэн байж болно
    const alreadyGranted = pay?.granted === true || !!pay?.grantedAt;
    if (alreadyGranted) {
      await payRef.set(
        {
          lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCheckSource: "client_poll",
        },
        { merge: true }
      );

      return noStoreJson({ ok: true, paid: true, status: "PAID", granted: true }, 200);
    }

    // ✅ invoices cross-check
    const invSnap = await invRef.get();
    if (invSnap.exists) {
      const inv = invSnap.data() as any;
      const invUid = String(inv?.uid || "").trim();
      const invCourseId = String(inv?.courseId || "").trim();
      const invAmount = normalizeMoney(inv?.amount);

      if (invUid && invUid !== decoded.uid) return jsonError("Invoice uid mismatch", 403);
      if (invCourseId && invCourseId !== courseId) return jsonError("Invoice courseId mismatch", 400);

      if (
        Number.isFinite(invAmount) &&
        Number.isFinite(payAmount) &&
        invAmount > 0 &&
        payAmount > 0 &&
        !amountsMatch(invAmount, payAmount)
      ) {
        return jsonError("Invoice amount mismatch", 400);
      }
    }

    // ✅ server truth price check
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) return jsonError("Course not found", 400);

    const c = courseSnap.data() as any;
    const coursePrice = typeof c?.price === "number" ? c.price : num(c?.price);
    if (!Number.isFinite(coursePrice) || coursePrice <= 0) {
      return jsonError("Invalid course price", 400);
    }

    const expectedAmount = Math.round(Number(coursePrice));
    if (Number.isFinite(payAmount) && payAmount > 0 && Math.round(payAmount) !== expectedAmount) {
      return jsonError("Payment amount mismatch", 400);
    }

    const alreadyPaid =
      pay?.paid === true || String(pay?.status || "").trim().toUpperCase() === "PAID";

    // 4) provider check (alreadyPaid биш бол л шалгана)
    let isPaidNow = alreadyPaid;
    let providerPaidAmount = 0;

    if (!isPaidNow) {
      const check = await qpayCheckInvoicePaid(invoiceId);

      if (!check.ok) {
        await payRef.set(
          {
            status: "PENDING",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCheckSource: "client_poll",
          },
          { merge: true }
        );

        return noStoreJson(
          { ok: false, paid: false, status: "ERROR", message: "QPay check failed" },
          400
        );
      }

      if (!check.paid) {
        await payRef.set(
          {
            status: "PENDING",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCheckSource: "client_poll",
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await invRef.set(
          {
            status: "PENDING",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return noStoreJson({ ok: true, paid: false, status: "PENDING" }, 200);
      }

      providerPaidAmount = Math.round(Number(check.paidAmount || 0));

      // ✅ amount mismatch block
      if (providerPaidAmount > 0 && providerPaidAmount !== expectedAmount) {
        await payRef.set(
          {
            status: "PENDING",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPaidAmount: providerPaidAmount,
            lastCheckSource: "client_poll",
          },
          { merge: true }
        );

        return jsonError("Paid amount mismatch", 400);
      }

      isPaidNow = true;

      await payRef.set(
        {
          paid: true,
          status: "PAID",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCheckSource: "client_poll",
        },
        { merge: true }
      );
    } else {
      await payRef.set(
        {
          lastClientCheckAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCheckSource: "client_poll",
        },
        { merge: true }
      );
    }

    if (!isPaidNow) {
      return noStoreJson({ ok: true, paid: false, status: "PENDING" }, 200);
    }

    // 5) duration resolve
    let durationDays = 30;
    let durationLabel = "30 хоног";

    const dd = Number(c?.durationDays);
    if (Number.isFinite(dd) && dd > 0) durationDays = dd;
    else {
      const parsed = parseDurationToDays(c?.durationLabel) ?? parseDurationToDays(c?.duration);
      if (parsed && parsed > 0) durationDays = parsed;
    }

    durationLabel =
      String(c?.durationLabel || "").trim() ||
      String(c?.duration || "").trim() ||
      `${durationDays} хоног`;

    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + durationDays * 24 * 60 * 60 * 1000
    );

    // ✅ idempotent finalize
    // callback route өмнө нь finalize хийчихсэн байж магадгүй.
    await db.runTransaction(async (tx) => {
      const freshPaySnap = await tx.get(payRef);
      if (!freshPaySnap.exists) return;

      const freshPay = freshPaySnap.data() as any;
      const freshGranted = freshPay?.granted === true || !!freshPay?.grantedAt;
      if (freshGranted) return;

      const freshInvSnap = await tx.get(invRef);
      const freshInv = freshInvSnap.exists ? (freshInvSnap.data() as any) : null;

      if (freshInv) {
        const invUid = String(freshInv?.uid || "").trim();
        const invCourseId = String(freshInv?.courseId || "").trim();
        const invAmount = normalizeMoney(freshInv?.amount);

        if (invUid && invUid !== decoded.uid) return;
        if (invCourseId && invCourseId !== courseId) return;
        if (
          Number.isFinite(invAmount) &&
          invAmount > 0 &&
          !amountsMatch(invAmount, expectedAmount)
        ) {
          return;
        }
      }

      const userRef = db.collection("users").doc(decoded.uid);

      tx.set(
        userRef,
        { updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      tx.set(
        userRef,
        {
          purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
          purchases: {
            [courseId]: {
              purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
              expiresAt,
              durationDays,
              durationLabel,
              amount: expectedAmount,
              invoiceRef: ref,
              qpayInvoiceId: invoiceId,
              status: "PAID",
            },
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        invRef,
        {
          uid: decoded.uid,
          courseId,
          amount: expectedAmount,
          status: "PAID",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAmount: providerPaidAmount > 0 ? providerPaidAmount : expectedAmount,
          durationDays,
          durationLabel,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        payRef,
        {
          paid: true,
          status: "PAID",
          granted: true,
          grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCheckSource: "client_poll",
        },
        { merge: true }
      );

      const purchaseDocId = `${decoded.uid}_${courseId}`;
      tx.set(
        db.collection("purchases").doc(purchaseDocId),
        {
          uid: decoded.uid,
          courseId,
          ref,
          status: "PAID",
          paid: true,
          amount: expectedAmount,
          paidAmount: providerPaidAmount > 0 ? providerPaidAmount : expectedAmount,
          qpayInvoiceId: invoiceId,
          durationDays,
          durationLabel,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return noStoreJson({ ok: true, paid: true, status: "PAID", granted: true }, 200);
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    console.error("[/api/qpay/checkout/check] ERROR:", e);
    return noStoreJson({ ok: false, message: msg }, 500);
  }
}