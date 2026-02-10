import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { toQrPngDataUrl } from "@/lib/qr";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

type CreateBody = {
  courseId: string;
  amount: number;
  description?: string;
};

type QPayAuthResp = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

// ⚠️ QPay response нэрс янз бүр байж болох тул "any" дээр resilient parse хийнэ
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

async function createInvoice(payload: {
  amount: number;
  description: string;
  callbackUrl: string;
  senderInvoiceNo: string;
}): Promise<AnyObj> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const invoiceCode = envOrThrow("QPAY_INVOICE_CODE");
  const accessToken = await getQPayAccessToken();

  const body = {
    invoice_code: invoiceCode,
    sender_invoice_no: payload.senderInvoiceNo,
    invoice_receiver_code: "terminal",
    invoice_description: payload.description,
    amount: payload.amount,
    callback_url: payload.callbackUrl,
  };

  const res = await fetch(`${baseUrl}/v2/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`QPAY invoice failed (${res.status}): ${text.slice(0, 600)}`);

  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("QPAY invoice: invalid JSON response");
  }

  // invoice_id байх ёстой
  const invoiceId = data?.invoice_id || data?.invoiceId;
  if (!invoiceId) throw new Error("QPAY invoice: invoice_id missing");

  return data as AnyObj;
}

// ✅ олон нэрнүүдээс утга шүүж авах helper
function pickString(obj: AnyObj, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    // 1) Firebase ID token verify
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    // 2) Validate body
    const body = (await req.json().catch(() => null)) as CreateBody | null;
    if (!body) return jsonError("Invalid JSON body", 400);

    const courseId = (body.courseId || "").trim();
    const amount = Number(body.amount);
    const description = (body.description || "").trim() || "Master AI payment";

    if (!courseId) return jsonError("courseId is required", 400);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("amount must be > 0", 400);

    // 3) Callback URL
    const rawCb = envOrThrow("QPAY_CALLBACK_URL");
    const appBaseUrl = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
    const callbackUrl = rawCb.includes("{APP_BASE_URL}")
      ? rawCb.replace("{APP_BASE_URL}", appBaseUrl || "http://localhost:3000")
      : rawCb;

    // 4) Create invoice
    const senderInvoiceNo = crypto.randomUUID();
    const inv = await createInvoice({ amount, description, callbackUrl, senderInvoiceNo });

    // 5) Resilient parse (QPay-н талбарын нэрс өөр байж болно)
    const qpayInvoiceId = pickString(inv, ["invoice_id", "invoiceId"]);
    const qrText = pickString(inv, ["qr_text", "qrText", "qr_string", "qrString"]);
    const qrImageBase64 = pickString(inv, ["qr_image", "qrImage"]); // base64 without data: prefix
    const shortUrl = pickString(inv, ["qPay_shortUrl", "qpay_shortUrl", "shortUrl", "qpayShortUrl"]);

    const urls = Array.isArray(inv?.urls) ? inv.urls : [];

    // ✅ хамгийн чухал: QR payload-оо заавал ол
    // 1) qr_image байвал шууд dataUrl
    // 2) qr_text байвал тэр дээрээс үүсгэнэ
    // 3) хоёулаа байхгүй бол shortUrl дээрээс QR үүсгэнэ (чи одоо яг ийм нөхцөлтэй байна)
    let qrImageDataUrl: string | null = null;
    let qrPayloadUsed: string | null = null;

    if (qrImageBase64) {
      qrImageDataUrl = `data:image/png;base64,${qrImageBase64}`;
      qrPayloadUsed = "qpay_qr_image";
    } else {
      const payloadForQr = (qrText || shortUrl || "").trim();
      if (payloadForQr) {
        qrImageDataUrl = await toQrPngDataUrl(payloadForQr);
        qrPayloadUsed = qrText ? "qpay_qr_text" : "generated_from_shortUrl";
      }
    }

    // 6) Save Firestore
    const db = adminDb();
    const docRef = await db.collection("qpayPayments").add({
      uid: decoded.uid,
      courseId,
      amount,
      description,
      status: "pending",

      qpayInvoiceId: qpayInvoiceId || null,
      senderInvoiceNo,

      // raw data
      qrText: qrText || null,
      qrImageBase64: qrImageBase64 || null,

      // ✅ UI-д шууд тавьж болох dataUrl (ихэвчлэн shortUrl дээрээс үүснэ)
      qrImageDataUrl: qrImageDataUrl || null,
      qrPayloadUsed: qrPayloadUsed || null,

      shortUrl: shortUrl || null,
      urls,

      paid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 7) Return to client
    return NextResponse.json(
      {
        ok: true,
        invoiceDocId: docRef.id,

        qpayInvoiceId: qpayInvoiceId || null,
        senderInvoiceNo,

        amount,
        description,

        qrText: qrText || null,
        qrImageDataUrl: qrImageDataUrl || null, // ✅ одоо shortUrl байхад ч QR заавал гарна
        shortUrl: shortUrl || null,
        urls,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}