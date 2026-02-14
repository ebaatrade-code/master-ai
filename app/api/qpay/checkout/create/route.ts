// FILE: app/api/qpay/checkout/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as admin from "firebase-admin";
import { toQrPngDataUrl } from "@/lib/qr";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

type CreateBody = {
  courseId: string;
  amount: number;
  description?: string;
};

type AnyObj = Record<string, any>;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function jsonError(message: string, status = 400) {
  return noStoreJson({ ok: false, message }, status);
}

// ---- In-memory token cache (per server instance) ----
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

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`QPAY auth failed (${res.status}): ${text.slice(0, 300)}`);

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  const token = String(data?.access_token || "").trim();
  if (!token) throw new Error("QPAY auth: access_token missing");

  const expiresSec =
    typeof data.expires_in === "number" && data.expires_in > 0 && data.expires_in < 86400 * 365
      ? data.expires_in
      : 3600;

  cachedAccessToken = { token, expMs: now + expiresSec * 1000 };
  return token;
}

async function createInvoice(payload: {
  amount: number;
  description: string;
  callbackUrl: string;
  senderInvoiceNo: string;
}): Promise<AnyObj> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const invoiceCode = envOrThrow("QPAY_INVOICE_CODE");
  const receiverCode = envOrThrow("QPAY_INVOICE_RECEIVER_CODE");
  const branchCode = process.env.QPAY_BRANCH_CODE || "ONLINE";

  const accessToken = await getQPayAccessToken();

  const body = {
    invoice_code: invoiceCode,
    sender_invoice_no: payload.senderInvoiceNo,
    invoice_receiver_code: receiverCode,
    sender_branch_code: branchCode,
    invoice_description: payload.description,
    amount: payload.amount,
    callback_url: payload.callbackUrl,
    allow_partial: false,
    allow_exceed: false,
    enable_expiry: "false",
    minimum_amount: null,
    maximum_amount: null,
  };

  const res = await fetch(`${baseUrl}/v2/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`QPAY invoice failed (${res.status}): ${text.slice(0, 600)}`);

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("QPAY invoice: invalid JSON response");
  }

  const invoiceId = data?.invoice_id || data?.invoiceId;
  if (!invoiceId) throw new Error("QPAY invoice: invoice_id missing");

  return data as AnyObj;
}

function pickString(obj: AnyObj, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function extractShortUrlFromUrls(urls: any): string {
  if (!Array.isArray(urls)) return "";
  for (const u of urls) {
    const link = typeof u?.link === "string" ? u.link : "";
    if (link && /https?:\/\/s\.qpay\.mn\//i.test(link)) return link;
  }
  return "";
}

// ✅ duration parse helper
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

// ✅ тухайн doc дээр QPay мэдээлэл “бэлэн” эсэх
function hasReadyQpay(p: any) {
  const qpayInvoiceId = String(p?.qpayInvoiceId || "").trim();
  if (!qpayInvoiceId) return false;
  const qr = String(p?.qrImageDataUrl || "").trim();
  const urls = Array.isArray(p?.urls) ? p.urls : [];
  const shortUrl = String(p?.shortUrl || "").trim();
  return !!qr || urls.length > 0 || !!shortUrl;
}

export async function POST(req: NextRequest) {
  try {
    // 1) auth
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    // 2) body
    const body = (await req.json().catch(() => null)) as CreateBody | null;
    if (!body) return jsonError("Invalid JSON body", 400);

    const courseId = (body.courseId || "").trim();
    const amount = Number(body.amount);
    const description = (body.description || "").trim() || "Master AI payment";

    if (!courseId) return jsonError("courseId is required", 400);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("amount must be > 0", 400);

    const db = adminDb();

    // 3) course info
    const courseSnap = await db.collection("courses").doc(courseId).get();
    const c = courseSnap.exists ? (courseSnap.data() as any) : null;

    const courseTitle = String(c?.title || c?.name || "").trim() || null;
    const courseThumbUrl = String(c?.thumbnailUrl || c?.thumbUrl || c?.thumbnail || "").trim() || null;

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

    // ✅ 4) тухайн course дээрх бүх unpaid docs (хамгийн сүүлийнхийг 1 л үлдээнэ)
    const unpaidQ = await db
      .collection("qpayPayments")
      .where("uid", "==", decoded.uid)
      .where("courseId", "==", courseId)
      .where("paid", "==", false)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const unpaidDocs = unpaidQ.docs;

    // ✅ ACTIVE: хамгийн сүүлийн unpaid docId-г ашиглана (үргэлж 1 түүх)
    const activeDocId = unpaidDocs.length ? unpaidDocs[0].id : db.collection("qpayPayments").doc().id;
    const activeData = unpaidDocs.length ? (unpaidDocs[0].data() as any) : null;

    // ✅ Бусад unpaid docs-ыг ARCHIVED болгоно (UI дээр олон мөр харагдахгүй)
    if (unpaidDocs.length > 1) {
      const batch = db.batch();
      for (let i = 1; i < unpaidDocs.length; i++) {
        const d = unpaidDocs[i];
        batch.set(
          d.ref,
          { status: "archived", archivedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        // invoices дотор нь ч мөн адил archived болгоно
        batch.set(
          db.collection("invoices").doc(d.id),
          { status: "ARCHIVED", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      await batch.commit();
    }

    const payDocId = activeDocId;
    const payDocRef = db.collection("qpayPayments").doc(payDocId);
    const invRef = db.collection("invoices").doc(payDocId);

    // ✅ 5) invoices: нэг мөр байх ёстой тул үргэлж UPDATE (amount хамгийн сүүлийнхээр хадгалагдана)
    await invRef.set(
      {
        uid: decoded.uid,
        courseId,
        courseTitle,
        courseThumbUrl,
        amount,
        status: "PENDING",
        durationDays,
        durationLabel,
        createdAt: activeData?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ 6) Хэрвээ ACTIVE doc дээр QPay бэлэн бөгөөд amount өөрчлөгдөөгүй бол reuse
    const prevAmount = Number(activeData?.amount);
    const sameAmount = Number.isFinite(prevAmount) && prevAmount === amount;

    if (activeData && sameAmount && hasReadyQpay(activeData)) {
      // invoices.qpay-г бүрэн нөхөөд буцаана
      await invRef.set(
        {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          qpay: {
            ref: payDocId,
            qpayInvoiceId: activeData?.qpayInvoiceId ?? null,
            senderInvoiceNo: activeData?.senderInvoiceNo ?? null,
            qrText: activeData?.qrText ?? null,
            qrImageDataUrl: activeData?.qrImageDataUrl ?? null,
            shortUrl: activeData?.shortUrl ?? null,
            urls: Array.isArray(activeData?.urls) ? activeData.urls : [],
          },
        },
        { merge: true }
      );

      return noStoreJson(
        {
          ok: true,
          reused: true,
          invoiceDocId: payDocId,
          qpayInvoiceId: activeData?.qpayInvoiceId ?? null,
          senderInvoiceNo: activeData?.senderInvoiceNo ?? null,
          amount,
          description,
          qrText: activeData?.qrText ?? null,
          qrImageDataUrl: activeData?.qrImageDataUrl ?? null,
          shortUrl: activeData?.shortUrl ?? null,
          urls: Array.isArray(activeData?.urls) ? activeData.urls : [],
          durationDays,
          durationLabel,
        },
        200
      );
    }

    // ✅ 7) Эндээс цааш: “шинэ invoice” үүсгэнэ
    // activeDocId-г солихгүй (өөрөөр хэлбэл түүх 1 л мөр)
    await payDocRef.set(
      {
        uid: decoded.uid,
        courseId,
        amount,
        description,
        status: "creating",
        paid: false,
        createdAt: activeData?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const senderInvoiceNo = crypto.randomUUID();

    const siteUrl = envOrThrow("SITE_URL").replace(/\/+$/, "");
    const cbSecret = (process.env.QPAY_CALLBACK_SECRET || "").trim();

    const callbackUrl =
      `${siteUrl}/api/qpay/callback?ref=${encodeURIComponent(payDocId)}` +
      `&courseId=${encodeURIComponent(courseId)}` +
      `&uid=${encodeURIComponent(decoded.uid)}` +
      (cbSecret ? `&s=${encodeURIComponent(cbSecret)}` : "");

    const inv = await createInvoice({ amount, description, callbackUrl, senderInvoiceNo });

    const qpayInvoiceId = pickString(inv, ["invoice_id", "invoiceId"]);
    const qrText = pickString(inv, ["qr_text", "qrText", "qr_string", "qrString"]);
    const qrImageBase64 = pickString(inv, ["qr_image", "qrImage"]);

    const urls =
      Array.isArray(inv?.urls)
        ? inv.urls
        : Array.isArray(inv?.payment_urls)
        ? inv.payment_urls
        : Array.isArray(inv?.deeplinks)
        ? inv.deeplinks
        : [];

    const shortUrl =
      pickString(inv, ["short_url", "shortUrl", "qpay_short_url", "qpayShortUrl"]) ||
      extractShortUrlFromUrls(urls);

    let qrImageDataUrl: string | null = null;

    if (qrImageBase64) {
      qrImageDataUrl = `data:image/png;base64,${qrImageBase64}`;
    } else {
      const payloadForQr = (qrText || shortUrl || "").trim();
      if (payloadForQr) {
        qrImageDataUrl = await toQrPngDataUrl(payloadForQr);
      }
    }

    // ✅ 8) qpayPayments update (same docId → түүх давхардахгүй)
    await payDocRef.set(
      {
        status: "pending",
        paid: false,
        senderInvoiceNo,
        qpayInvoiceId: qpayInvoiceId || null,
        qrText: qrText || null,
        qrImageDataUrl: qrImageDataUrl || null,
        shortUrl: shortUrl || null,
        urls,
        callbackUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ 9) invoices.qpay бүрэн хадгална
    await invRef.set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        qpay: {
          ref: payDocId,
          qpayInvoiceId: qpayInvoiceId || null,
          senderInvoiceNo,
          qrText: qrText || null,
          qrImageDataUrl: qrImageDataUrl || null,
          shortUrl: shortUrl || null,
          urls,
        },
      },
      { merge: true }
    );

    return noStoreJson(
      {
        ok: true,
        reused: false,
        invoiceDocId: payDocId,
        qpayInvoiceId: qpayInvoiceId || null,
        senderInvoiceNo,
        amount,
        description,
        qrText: qrText || null,
        qrImageDataUrl: qrImageDataUrl || null,
        shortUrl: shortUrl || null,
        urls,
        durationDays,
        durationLabel,
      },
      200
    );
  } catch (e: any) {
    console.error("[/api/qpay/checkout/create] ERROR:", e);
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ ok: false, message: msg }, 500);
  }
}