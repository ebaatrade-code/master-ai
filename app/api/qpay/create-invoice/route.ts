// FILE: app/api/qpay/create-invoice/route.ts
import { NextResponse } from "next/server";
import {
  qpayCreateInvoice,
  extractShortUrl,
  toDataUrlPng,
  type QPayInvoiceCreateReq,
} from "@/lib/qpay";

// ✅ таны проект дээр adminAuth/adminDb нь "function" байж байгаа (=> instance буцаана)
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

// ✅ App Router caching хамгаалалт
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
  });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isAmount(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0 && x < 1_000_000_000;
}

/**
 * ✅ adminAuth/adminDb чинь instance эсвэл function байж болно.
 * - зарим проект: export const adminAuth = getAuth();
 * - таны проект: export const adminAuth = () => getAuth();
 */
function getAdminAuth(): any {
  const a: any = adminAuth as any;
  return typeof a === "function" ? a() : a;
}
function getAdminDb(): any {
  const d: any = adminDb as any;
  return typeof d === "function" ? d() : d;
}

async function requireUid(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  try {
    const aa = getAdminAuth();
    const decoded = await aa.verifyIdToken(m[1]);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

type Body = {
  ref?: unknown; // invoices doc id
  amount?: unknown;
  description?: unknown;
  courseId?: unknown;
  uid?: unknown;
  orderId?: unknown;
  senderInvoiceNo?: unknown;
};

function num(x: unknown) {
  if (typeof x === "number") return x;
  if (typeof x === "string" && x.trim()) return Number(x);
  return NaN;
}

async function resolveAmountFromCourse(courseId: string) {
  const db = getAdminDb();
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) return { ok: false as const, amount: null as any, error: "Course not found" };

  const d = courseSnap.data() as any;
  const price = typeof d?.price === "number" ? d.price : num(d?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false as const, amount: null as any, error: "Invalid course price" };
  }
  return { ok: true as const, amount: Math.round(price) };
}

export async function POST(req: Request) {
  try {
    const siteUrl = mustEnv("SITE_URL");
    const invoiceCode = mustEnv("QPAY_INVOICE_CODE");
    const receiverCode = mustEnv("QPAY_INVOICE_RECEIVER_CODE");
    const branchCode = process.env.QPAY_BRANCH_CODE || "ONLINE";

    const authedUid = await requireUid(req);
    if (!authedUid) return noStoreJson({ error: "Unauthorized" }, 401);

    const json = (await req.json().catch(() => null)) as Body | null;
    if (!json) return noStoreJson({ error: "Invalid JSON" }, 400);

    const ref = String(json.ref ?? "").trim();
    if (!ref) return noStoreJson({ error: "Missing ref" }, 400);

    const uid = String(json.uid ?? "").trim();
    if (!uid) return noStoreJson({ error: "Missing uid" }, 400);
    if (uid !== authedUid) return noStoreJson({ error: "Forbidden" }, 403);

    const courseId = String(json.courseId ?? "").trim() || null;

    // ✅ Amount source:
    // - courseId байвал: Firestore -> course.price (server truth)
    // - courseId байхгүй бол: client amount (backward compatible)
    let resolvedAmount: number | null = null;
    let amountSource: "course" | "client" = "client";

    if (courseId) {
      const ra = await resolveAmountFromCourse(courseId);
      if (!ra.ok) return noStoreJson({ error: ra.error }, 400);
      resolvedAmount = ra.amount;
      amountSource = "course";
    } else {
      const a = typeof json.amount === "string" ? Number(json.amount) : json.amount;
      if (!isAmount(a)) return noStoreJson({ error: "Invalid amount" }, 400);
      resolvedAmount = a;
      amountSource = "client";
    }

    const amount = resolvedAmount;

    const description = String(json.description ?? "Master AI payment").trim();
    if (description.length < 2 || description.length > 140) {
      return noStoreJson({ error: "Invalid description" }, 400);
    }

    // ✅ Firestore existing invoice check (idempotent)
    const db = getAdminDb();
    const invRef = db.collection("invoices").doc(ref);
    const snap = await invRef.get();
    const existing = snap.exists ? (snap.data() as any) : null;

    const existingAmount = typeof existing?.amount === "number" ? existing.amount : num(existing?.amount);
    const existingQpayInvoiceId = String(existing?.qpay?.qpayInvoiceId || "").trim();
    const existingQr = String(existing?.qpay?.qrImageDataUrl || "").trim();
    const existingUrls = Array.isArray(existing?.qpay?.urls) ? existing.qpay.urls : [];
    const existingShortUrl = String(existing?.qpay?.shortUrl || "").trim();

    const canReuse =
      existingAmount === amount &&
      !!existingQpayInvoiceId &&
      (!!existingQr || existingUrls.length > 0 || !!existingShortUrl);

    if (canReuse) {
      return noStoreJson({
        ok: true,
        reused: true,
        qpayInvoiceId: existingQpayInvoiceId,
        qrText: existing?.qpay?.qrText ?? null,
        qrImageBase64: null,
        qrImageDataUrl: existing?.qpay?.qrImageDataUrl ?? null,
        urls: existingUrls,
        shortUrl: existing?.qpay?.shortUrl ?? null,
        amount,
        amountSource,
        description,
        senderInvoiceNo: existing?.qpay?.senderInvoiceNo ?? null,
        orderId: existing?.qpay?.senderInvoiceNo ?? ref,
        callbackUrl: existing?.qpay?.callbackUrl ?? null,
      });
    }

    // ✅ amount өөрчлөгдвөл шинэ invoice (safe idempotency)
    const senderInvoiceNoRaw = String(
      json.senderInvoiceNo ?? json.orderId ?? `${ref}-${amount}-${Date.now()}`
    );
    const sender_invoice_no =
      senderInvoiceNoRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) ||
      `${ref}-${Date.now()}`.slice(0, 40);

    const orderId = String(json.orderId ?? sender_invoice_no).slice(0, 80);

    const callback_url =
      `${siteUrl.replace(/\/$/, "")}/api/qpay/callback` +
      `?orderId=${encodeURIComponent(orderId)}` +
      `&courseId=${encodeURIComponent(String(courseId ?? ""))}` +
      `&uid=${encodeURIComponent(String(uid ?? ""))}` +
      `&ref=${encodeURIComponent(ref)}`;

    const payload: QPayInvoiceCreateReq = {
      invoice_code: invoiceCode,
      sender_invoice_no,
      invoice_receiver_code: receiverCode,
      sender_branch_code: branchCode,
      invoice_description: description,
      amount,
      callback_url,
      allow_partial: false,
      allow_exceed: false,
      enable_expiry: "false",
      minimum_amount: null,
      maximum_amount: null,
    };

    const inv = await qpayCreateInvoice(payload);

    const urls = Array.isArray(inv.urls) ? inv.urls : [];
    const shortUrl = extractShortUrl(urls);
    const qrImageDataUrl = toDataUrlPng(inv.qr_image ?? null);

    await invRef.set(
      {
        uid,
        courseId,
        amount,
        status: existing?.status || "pending",
        updatedAt: FieldValue.serverTimestamp(),
        qpay: {
          ref,
          qpayInvoiceId: inv.invoice_id,
          senderInvoiceNo: sender_invoice_no,
          qrText: inv.qr_text ?? null,
          qrImageDataUrl: qrImageDataUrl ?? null,
          shortUrl: shortUrl ?? null,
          urls,
          callbackUrl: callback_url,
        },
      },
      { merge: true }
    );

    return noStoreJson({
      ok: true,
      reused: false,
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text ?? null,
      qrImageBase64: inv.qr_image ?? null,
      qrImageDataUrl,
      urls,
      shortUrl,
      amount,
      amountSource,
      description,
      senderInvoiceNo: sender_invoice_no,
      orderId,
      callbackUrl: callback_url,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ error: msg }, 500);
  }
}