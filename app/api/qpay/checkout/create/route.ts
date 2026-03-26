import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as admin from "firebase-admin";
import { toQrPngDataUrl } from "@/lib/qr";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";

type CreateBody = {
  courseId: string;
  // ⚠️ amount-ыг client-ээс авахгүй (хуучин client байж магадгүй тул optional үлдээнэ)
  amount?: number;
  description?: string;
};

type AnyObj = Record<string, any>;

type SafeQPayUrl = {
  name?: string;
  description?: string;
  logo?: string;
  link: string;
};

const LOCAL_COOLDOWN_MS = 1200;
const inMemoryCreateCooldown = new Map<string, number>();

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

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

function jsonError(message: string, status = 400) {
  return noStoreJson({ ok: false, message }, status);
}

function isSafeCourseId(v: string, max = 120) {
  return /^[A-Za-z0-9_-]{1,120}$/.test(v) && v.length <= max;
}

function cleanupCooldownMap(now = Date.now()) {
  for (const [k, exp] of inMemoryCreateCooldown.entries()) {
    if (exp <= now) inMemoryCreateCooldown.delete(k);
  }
}

/** Returns true if the key is within the cooldown window (request should be blocked). */
function isCooldownBlocked(key: string): boolean {
  const now = Date.now();
  cleanupCooldownMap(now);
  const exp = inMemoryCreateCooldown.get(key) ?? 0;
  if (exp > now) return true;
  inMemoryCreateCooldown.set(key, now + LOCAL_COOLDOWN_MS);
  return false;
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

// ---- In-memory token cache (per server instance) ----
let cachedAccessToken: { token: string; expMs: number } | null = null;

async function getQPayAccessToken(): Promise<string> {
  const baseUrl = (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn").replace(/\/+$/, "");
  // Support both QPAY_USERNAME/PASSWORD and QPAY_CLIENT_ID/CLIENT_SECRET
  const username = process.env.QPAY_USERNAME || process.env.QPAY_CLIENT_ID || "";
  const password = process.env.QPAY_PASSWORD || process.env.QPAY_CLIENT_SECRET || "";
  if (!username || !password) throw new Error("Missing QPay credentials");

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
  const baseUrl = (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn").replace(/\/+$/, "");
  const invoiceCode = process.env.QPAY_INVOICE_CODE || "";
  if (!invoiceCode) throw new Error("Missing env: QPAY_INVOICE_CODE");
  const receiverCode = process.env.QPAY_INVOICE_RECEIVER_CODE || process.env.QPAY_RECEIVER_CODE || "";
  if (!receiverCode) throw new Error("Missing env: QPAY_INVOICE_RECEIVER_CODE");
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

  const res = await fetchWithTimeout(
    `${baseUrl}/v2/invoice`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    },
    20000
  );

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

function pickString(obj: AnyObj, keys: string[], maxLen = 5000): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, maxLen);
  }
  return "";
}

function extractShortUrlFromUrls(urls: any): string {
  if (!Array.isArray(urls)) return "";
  for (const u of urls) {
    const link = typeof u?.link === "string" ? u.link.trim() : "";
    // Match both https://s.qpay.mn/... and https://qpay.mn/s/... formats
    if (link && /qpay\.mn\/(s\/|q\/)/i.test(link)) return link;
    if (link && /^https?:\/\/s\.qpay\.mn\//i.test(link)) return link;
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

function isAmountSafe(n: any) {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1_000_000_000;
}

function normalizeDescription(input?: string) {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return s || "Master AI payment";
}

function sanitizeString(v: unknown, max = 300) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function normalizeQPayUrls(input: any): SafeQPayUrl[] {
  if (!Array.isArray(input)) return [];

  const out: SafeQPayUrl[] = [];

  for (const item of input.slice(0, 20)) {
    // Try both "link" and "url" field names (QPay API uses either)
    const link = sanitizeString(item?.link || item?.url || item?.deeplink, 1200);
    // Block dangerous schemes; allow https + bank deeplink custom schemes (khanbank://, golomtbank://, etc.)
    if (!link || /^(javascript|data|vbscript):/i.test(link)) continue;
    if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(link)) continue;

    out.push({
      name: sanitizeString(item?.name, 120),
      description: sanitizeString(item?.description, 180),
      logo: sanitizeString(item?.logo, 1200),
      link,
    });
  }

  return out;
}

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  const firstForwarded = xff.split(",")[0]?.trim() || "";
  return firstForwarded || realIp || "";
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}


export async function POST(req: NextRequest) {
  try {
    // 1) auth
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    // ✅ revoked token check additive security
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    // 2) body
    const body = (await req.json().catch(() => null)) as CreateBody | null;
    if (!body) return jsonError("Invalid JSON body", 400);

    const courseId = String(body.courseId || "").trim();
    const description = normalizeDescription(body.description);

    if (!courseId) return jsonError("courseId is required", 400);
    if (!isSafeCourseId(courseId)) return jsonError("Invalid courseId", 400);
    if (description.length < 2 || description.length > 140) {
      return jsonError("description length invalid", 400);
    }

    const db = adminDb();

    // ✅ Cooldown guard: duplicate request ирвэл existing unpaid invoice-г reuse хийж буцаана
    if (isCooldownBlocked(`${decoded.uid}:${courseId}`)) {
      const existingQ = await db
        .collection("qpayPayments")
        .where("uid", "==", decoded.uid)
        .where("courseId", "==", courseId)
        .where("paid", "==", false)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!existingQ.empty) {
        const ed = existingQ.docs[0].data() as any;
        if (hasReadyQpay(ed)) {
          return noStoreJson(
            {
              ok: true,
              reused: true,
              invoiceDocId: existingQ.docs[0].id,
              qpayInvoiceId: ed.qpayInvoiceId ?? null,
              senderInvoiceNo: ed.senderInvoiceNo ?? null,
              amount: Number(ed.amount),
              description: String(ed.description || ""),
              qrText: ed.qrText ?? null,
              qrImageDataUrl: ed.qrImageDataUrl ?? null,
              shortUrl: ed.shortUrl ?? null,
              urls: Array.isArray(ed.urls) ? ed.urls : [],
              durationDays: ed.durationDays ?? null,
              durationLabel: ed.durationLabel ?? null,
            },
            200
          );
        }
      }

      return noStoreJson({ ok: false, message: "Too many requests. Please wait a moment." }, 429);
    }

    const userAgent = sanitizeString(req.headers.get("user-agent"), 300);
    const origin = sanitizeString(req.headers.get("origin"), 300);
    const clientIp = getClientIp(req);
    const ipHash = clientIp ? sha256Hex(clientIp) : "";

    // 3) course info (✅ SERVER TRUTH)
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) return jsonError("Course not found", 404);

    const c = courseSnap.data() as any;

    // ✅ amount = course.price (client amount-ыг бүрэн үл тооно)
    const price = typeof c?.price === "number" ? c.price : Number(c?.price);
    const amount = Number.isFinite(price) ? Math.round(price) : NaN;
    if (!isAmountSafe(amount)) return jsonError("Invalid course price", 400);

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

    // ✅ User doc load (purchase validity check хийхийн тулд)
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const u = userSnap.exists ? (userSnap.data() as any) : null;
    const purchasedIds: string[] = Array.isArray(u?.purchasedCourseIds) ? u.purchasedCourseIds : [];

    if (purchasedIds.includes(courseId)) {
      // ✅ Зөвхөн идэвхтэй (дуусаагүй) purchase байвал alreadyPurchased буцаана.
      // Хугацаа дууссан бол re-purchase-г зөвшөөрнө.
      const purchase = u?.purchases?.[courseId] ?? null;
      const purchaseIsActive = (() => {
        if (!purchase) return false;
        if (purchase.status !== "PAID") return false;
        if (purchase.active === false) return false;
        const raw = purchase.expiresAt;
        if (!raw) return false;
        const expMs: number =
          typeof raw?.toMillis === "function"
            ? raw.toMillis()
            : typeof raw?.toDate === "function"
            ? (raw.toDate() as Date).getTime()
            : typeof raw === "number"
            ? raw
            : new Date(String(raw)).getTime();
        if (!Number.isFinite(expMs)) return false;
        return expMs > Date.now();
      })();

      if (purchaseIsActive) {
        return noStoreJson(
          { ok: true, alreadyPurchased: true, courseId, amount, durationDays, durationLabel },
          200
        );
      }
      // Purchase хугацаа дууссан эсвэл хүчингүй — re-purchase хийх боломжтой, доош үргэлжлүүлнэ
    }

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

    // ✅ Бусад unpaid docs-ыг ARCHIVED болгоно
    if (unpaidDocs.length > 1) {
      const batch = db.batch();
      for (let i = 1; i < unpaidDocs.length; i++) {
        const d = unpaidDocs[i];
        batch.set(
          d.ref,
          {
            status: "archived",
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
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

    // ✅ 5) invoices: нэг мөр байх ёстой тул үргэлж UPDATE
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
        requestMeta: {
          ipHash: ipHash || null,
          userAgent: userAgent || null,
          origin: origin || null,
        },
      },
      { merge: true }
    );

    // ✅ 6) Хэрвээ ACTIVE doc дээр QPay бэлэн бол reuse (amount нь server price-тай таарна)
    const prevAmount = Number(activeData?.amount);
    const sameAmount = Number.isFinite(prevAmount) && prevAmount === amount;
    // Only reuse if cached invoice has bank deeplinks — otherwise create fresh to get URLs
    const cachedHasUrls = Array.isArray(activeData?.urls) && activeData.urls.length > 0;

    if (activeData && sameAmount && hasReadyQpay(activeData) && cachedHasUrls) {
      await payDocRef.set(
        {
          uid: decoded.uid,
          courseId,
          amount,
          status: "pending",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          requestMeta: {
            ipHash: ipHash || null,
            userAgent: userAgent || null,
            origin: origin || null,
          },
        },
        { merge: true }
      );

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

    // ✅ 7) шинэ invoice үүсгэнэ (same docId → түүх давхардахгүй)
    await payDocRef.set(
      {
        uid: decoded.uid,
        courseId,
        amount,
        description,
        status: "creating",
        paid: false,
        granted: false,
        createdAt: activeData?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestMeta: {
          ipHash: ipHash || null,
          userAgent: userAgent || null,
          origin: origin || null,
        },
      },
      { merge: true }
    );

    const senderInvoiceNo = crypto.randomUUID();

    const siteUrl = envOrThrow("SITE_URL").replace(/\/+$/, "");
    const cbSecret = String(process.env.QPAY_CALLBACK_SECRET || "").trim();

    // ✅ Callback URL-г зөвхөн ref + s гэж богиносгоно (QPay max 255 chars)
    // uid, courseId, ts, sig-г URL-д оруулахгүй — Firestore-оос ref-ээр уншина
    const callbackUrl =
      `${siteUrl}/api/qpay/callback?ref=${encodeURIComponent(payDocId)}` +
      (cbSecret ? `&s=${encodeURIComponent(cbSecret)}` : "");

    const inv = await createInvoice({ amount, description, callbackUrl, senderInvoiceNo });

    const qpayInvoiceId = pickString(inv, ["invoice_id", "invoiceId"], 200);
    const qrText = pickString(inv, ["qr_text", "qrText", "qr_string", "qrString"], 5000);
    const qrImageBase64 = pickString(inv, ["qr_image", "qrImage"], 2_000_000);

    const rawUrls =
      Array.isArray(inv?.urls)
        ? inv.urls
        : Array.isArray(inv?.payment_urls)
        ? inv.payment_urls
        : Array.isArray(inv?.deeplinks)
        ? inv.deeplinks
        : [];

    const urls = normalizeQPayUrls(rawUrls);

    const shortUrl =
      pickString(inv, ["short_url", "shortUrl", "qpay_short_url", "qpayShortUrl"], 1200) ||
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

    // ✅ 8) qpayPayments update
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
        // ✅ non-breaking нэмэлт audit/meta
        durationDays,
        durationLabel,
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
        amountSource: "course",
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