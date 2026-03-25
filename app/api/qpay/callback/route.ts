// FILE: app/api/qpay/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type QPayCheckResult = {
  ok: boolean;
  paid: boolean;
  paidAmount: number;
  detail: any;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function ok() {
  return noStoreJson({ ok: true }, 200);
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isSafeId(v: string, max = 160) {
  return /^[A-Za-z0-9_-]{1,160}$/.test(v) && v.length <= max;
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

function normalizeDurationDays(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.round(n);
}

function addDaysTimestamp(days: number) {
  return admin.firestore.Timestamp.fromMillis(
    Date.now() + days * 24 * 60 * 60 * 1000
  );
}

function safeString(v: unknown, max = 500) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
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

function timingSafeEqualHex(a: string, b: string) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
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

  if (!res.ok) return "NO_TOKEN";

  const data = (await res.json().catch(() => null)) as any;
  const token = safeString(data?.access_token, 5000);
  if (!token) return "NO_TOKEN";

  const expiresSec =
    typeof data?.expires_in === "number" &&
    data.expires_in > 0 &&
    data.expires_in < 86400 * 365
      ? data.expires_in
      : 3600;

  cachedAccessToken = { token, expMs: now + expiresSec * 1000 };
  return token;
}

async function qpayCheckPaid(invoiceId: string): Promise<QPayCheckResult> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const accessToken = await getQPayAccessToken();

  if (!accessToken || accessToken === "NO_TOKEN") {
    return {
      ok: false,
      paid: false,
      paidAmount: 0,
      detail: { message: "No token" },
    };
  }

  const res = await fetchWithTimeout(
    `${baseUrl}/v2/payment/check`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        object_type: "INVOICE",
        object_id: invoiceId,
      }),
    },
    20000
  );

  const text = await res.text().catch(() => "");
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice?.(0, 2000) || "" };
  }

  if (!res.ok) {
    return {
      ok: false,
      paid: false,
      paidAmount: 0,
      detail: data,
    };
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
    paidAmount: Number.isFinite(paidAmount) ? paidAmount : 0,
    detail: data,
  };
}

async function handleCallback(req: Request) {
  try {
    const url = new URL(req.url);
    const { searchParams } = url;

    // Callback URL: зөвхөн ref + s (QPay max 255 chars тул богиносгосон)
    const ref = safeString(searchParams.get("ref"), 200);
    const secret = safeString(searchParams.get("s"), 500);
    const must = String(process.env.QPAY_CALLBACK_SECRET || "").trim();

    if (!ref) return ok();
    if (!isSafeId(ref)) return ok();

    // QPAY_CALLBACK_SECRET заавал шаардана — тохируулаагүй бол callback-г хүлээн авахгүй
    if (!must) {
      console.error("[qpay/callback] QPAY_CALLBACK_SECRET is not set — callback rejected");
      return ok();
    }
    if (!timingSafeEqualHex(
      Buffer.from(secret).toString("hex"),
      Buffer.from(must).toString("hex")
    )) {
      console.warn("[qpay/callback] Invalid secret — possible spoofed callback");
      return ok();
    }

    const db = adminDb();

    const payRef = db.collection("qpayPayments").doc(ref);
    const invRef = db.collection("invoices").doc(ref);

    // 1) qpayPayments байхгүй бол invoices-оос fallback
    let paySnap = await payRef.get();
    let pay: any = paySnap.exists ? (paySnap.data() as any) : null;

    if (!pay) {
      const invSnap = await invRef.get();
      if (!invSnap.exists) return ok();

      const inv = invSnap.data() as any;
      const fallbackInvoiceId = safeString(inv?.qpay?.qpayInvoiceId, 200);

      if (!fallbackInvoiceId) return ok();

      const fallbackUid = safeString(inv?.uid, 200);
      const fallbackCourseId = safeString(inv?.courseId, 200);

      if (!fallbackUid || !fallbackCourseId) return ok();
      if (!isSafeId(fallbackCourseId)) return ok();

      pay = {
        uid: fallbackUid,
        courseId: fallbackCourseId,
        amount: inv?.amount ?? null,
        qpayInvoiceId: fallbackInvoiceId,
        status: String(inv?.status || "PENDING").toUpperCase(),
        paid: String(inv?.status || "").toUpperCase() === "PAID",
        durationDays: inv?.durationDays ?? null,
        durationLabel: inv?.durationLabel ?? null,
      };

      await payRef.set(
        {
          uid: pay.uid,
          courseId: pay.courseId,
          amount: pay.amount,
          qpayInvoiceId: pay.qpayInvoiceId,
          status: pay.status || "PENDING",
          paid: !!pay.paid,
          durationDays: pay.durationDays ?? null,
          durationLabel: pay.durationLabel ?? null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          callbackMeta: {
            recoveredFromInvoice: true,
            recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      paySnap = await payRef.get();
      pay = paySnap.exists ? (paySnap.data() as any) : pay;
    }

    const invoiceId = safeString(pay?.qpayInvoiceId, 200);
    if (!invoiceId) return ok();

    const uid = safeString(pay?.uid, 200);
    const courseId = safeString(pay?.courseId, 200);

    if (!uid || !courseId) return ok();
    if (!isSafeId(courseId)) return ok();

    const statusNow = String(pay?.status || "").toUpperCase();
    if (pay?.paid === true || statusNow === "PAID") {
      await payRef.set(
        {
          callbackMeta: {
            lastDuplicateCallbackAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return ok();
    }

    // 2) provider check
    const check = await qpayCheckPaid(invoiceId);
    if (!check.ok || !check.paid) {
      await payRef.set(
        {
          callbackMeta: {
            lastCheckAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCheckOk: !!check.ok,
            lastPaidState: !!check.paid,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return ok();
    }

    const expectedAmount = normalizeMoney(pay?.amount ?? 0);
    if (Number.isFinite(expectedAmount) && expectedAmount > 0) {
      if (
        check.paidAmount > 0 &&
        normalizeMoney(check.paidAmount) + 0.0001 < expectedAmount
      ) {
        await payRef.set(
          {
            callbackMeta: {
              lastAmountMismatchAt:
                admin.firestore.FieldValue.serverTimestamp(),
              providerPaidAmount: normalizeMoney(check.paidAmount),
              expectedAmount,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return ok();
      }
    }

    // 5) transaction: cross-check + mark paid + grant
    await db.runTransaction(async (tx) => {
      const [paySnap2, invSnap2, courseSnap, userSnap] = await Promise.all([
        tx.get(payRef),
        tx.get(invRef),
        tx.get(db.collection("courses").doc(courseId)),
        tx.get(db.collection("users").doc(uid)),
      ]);

      const pay2 = paySnap2.exists ? (paySnap2.data() as any) : null;
      const inv2 = invSnap2.exists ? (invSnap2.data() as any) : null;
      const course = courseSnap.exists ? (courseSnap.data() as any) : null;
      const user = userSnap.exists ? (userSnap.data() as any) : null;

      if (!pay2) return;
      if (pay2?.paid === true || String(pay2?.status || "").toUpperCase() === "PAID") {
        return;
      }

      // ---- Cross-check хамгийн чухал ----
      const payUid = safeString(pay2?.uid, 200);
      const payCourseId = safeString(pay2?.courseId, 200);
      const invUid = safeString(inv2?.uid, 200);
      const invCourseId = safeString(inv2?.courseId, 200);

      if (!payUid || !payCourseId) return;
      if (payUid !== uid || payCourseId !== courseId) return;

      if (inv2) {
        if (!invUid || !invCourseId) return;
        if (invUid !== uid || invCourseId !== courseId) return;

        const invAmount = normalizeMoney(inv2?.amount ?? NaN);
        const payAmount = normalizeMoney(pay2?.amount ?? NaN);
        if (
          Number.isFinite(invAmount) &&
          Number.isFinite(payAmount) &&
          !amountsMatch(invAmount, payAmount)
        ) {
          return;
        }

        const invQPayInvoiceId = safeString(inv2?.qpay?.qpayInvoiceId, 200);
        if (invQPayInvoiceId && invQPayInvoiceId !== invoiceId) return;
      }

      if (!course) return;

      const coursePrice = normalizeMoney(course?.price);
      const payAmount = normalizeMoney(pay2?.amount ?? NaN);

      if (!Number.isFinite(coursePrice) || coursePrice <= 0) return;
      if (!Number.isFinite(payAmount) || !amountsMatch(coursePrice, payAmount)) return;

      const payQPayInvoiceId = safeString(pay2?.qpayInvoiceId, 200);
      if (!payQPayInvoiceId || payQPayInvoiceId !== invoiceId) return;

      const durationDays = normalizeDurationDays(
        pay2?.durationDays ?? inv2?.durationDays ?? course?.durationDays ?? 30
      );
      const durationLabel =
        String(
          pay2?.durationLabel ??
            inv2?.durationLabel ??
            course?.durationLabel ??
            `${durationDays} хоног`
        ).trim() || `${durationDays} хоног`;

      const paidAtTs = admin.firestore.FieldValue.serverTimestamp();
      const expiresAtTs = addDaysTimestamp(durationDays);

      const currentPurchasedIds: string[] = Array.isArray(user?.purchasedCourseIds)
        ? user.purchasedCourseIds
        : [];

      const alreadyHasCourse = currentPurchasedIds.includes(courseId);

      const providerPaidAmount =
        check.paidAmount > 0 ? normalizeMoney(check.paidAmount) : coursePrice;

      // mark paid + granted
      tx.set(
        payRef,
        {
          paid: true,
          granted: true,
          status: "PAID",
          paidAt: paidAtTs,
          callbackAt: admin.firestore.FieldValue.serverTimestamp(),
          paidAmount: providerPaidAmount,
          providerCheck: {
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
            ok: true,
            paid: true,
            paidAmount: providerPaidAmount,
            invoiceId,
            detailHash: sha256Hex(JSON.stringify(check.detail ?? {})).slice(0, 64),
          },
          callbackMeta: {
            lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        invRef,
        {
          status: "PAID",
          paidAt: paidAtTs,
          paidAmount: providerPaidAmount,
          durationDays,
          durationLabel,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          qpay: {
            ...(inv2?.qpay || {}),
            qpayInvoiceId: invoiceId,
          },
        },
        { merge: true }
      );

      // unlock
      tx.set(
        db.collection("users").doc(uid),
        {
          purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
          purchases: {
            [courseId]: {
              ref,
              status: "PAID",
              amount: coursePrice,
              durationDays,
              durationLabel,
              paidAt: paidAtTs,
              expiresAt: expiresAtTs,
            },
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // audit/history
      const purchaseDocId = `${uid}_${courseId}`;
      const courseTitle = safeString(course?.title ?? "", 500);

      tx.set(
        db.collection("purchases").doc(purchaseDocId),
        {
          uid,
          courseId,
          courseTitle,
          ref,
          status: "PAID",
          paid: true,
          amount: coursePrice,
          paidAmount: providerPaidAmount,
          qpayInvoiceId: invoiceId,
          durationDays,
          durationLabel,
          paidAt: paidAtTs,
          expiresAt: expiresAtTs,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt:
            alreadyHasCourse && inv2?.createdAt
              ? inv2.createdAt
              : admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Append-only revenue ledger — keyed by payment ref, never overwritten
      tx.set(db.collection("revenueLedger").doc(ref), {
        courseId,
        courseTitle,
        amount: coursePrice,
        paidAmount: providerPaidAmount,
        uid,
        ref,
        durationDays,
        durationLabel,
        paidAt: paidAtTs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return ok();
  } catch (e) {
    console.error("[/api/qpay/callback] ERROR:", e);
    return ok();
  }
}

export async function GET(req: Request) {
  return handleCallback(req);
}

export async function POST(req: Request) {
  return handleCallback(req);
}