import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.QPAY_BASE || "https://merchant.qpay.mn";
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE || ""; // QPAY-ээс өгсөн INVOICE_CODE
const RECEIVER_CODE = process.env.QPAY_RECEIVER_CODE || "terminal"; // ихэвчлэн terminal
const BRANCH_CODE = process.env.QPAY_BRANCH_CODE || "ONLINE";
const CALLBACK_URL = process.env.QPAY_CALLBACK_URL || ""; // хүсвэл тавина (заавал биш)

const USERNAME = process.env.QPAY_USERNAME || "";
const PASSWORD = process.env.QPAY_PASSWORD || "";

async function getAccessToken() {
  if (!USERNAME || !PASSWORD) {
    return { ok: false as const, status: 500, message: "QPAY_USERNAME / QPAY_PASSWORD env алга." };
  }
  const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");

  const res = await fetch(`${BASE}/v2/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      message: data?.message || "Нэвтрэх нэр, нууц үг буруу",
      raw: data,
    };
  }

  return { ok: true as const, token: data?.access_token as string, raw: data };
}

function toDataUrlMaybe(qr_image: any) {
  if (!qr_image) return undefined;
  const s = String(qr_image);

  // Already url or data url
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:image/")) return s;

  // base64 string -> make it data url
  return `data:image/png;base64,${s}`;
}

export async function POST(req: Request) {
  try {
    if (!INVOICE_CODE) {
      return NextResponse.json(
        { ok: false, error: "NO_INVOICE_CODE", message: "QPAY_INVOICE_CODE env тохируулаагүй байна." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount ?? 0);
    const courseTitle = String(body?.courseTitle ?? "Online course");
    const purchaseId = String(body?.purchaseId ?? "ORDER");

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "BAD_AMOUNT", message: "amount буруу байна." },
        { status: 400 }
      );
    }

    const tokenRes = await getAccessToken();
    if (!tokenRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "auth/token",
          status: tokenRes.status,
          message: tokenRes.message,
          raw: tokenRes.raw,
        },
        { status: tokenRes.status || 401 }
      );
    }

    const accessToken = tokenRes.token;

    const payload: any = {
      invoice_code: INVOICE_CODE,
      sender_invoice_no: purchaseId, // чиний purchaseId
      invoice_receiver_code: RECEIVER_CODE,
      sender_branch_code: BRANCH_CODE,
      invoice_description: courseTitle,
      amount,
    };

    if (CALLBACK_URL) payload.callback_url = CALLBACK_URL;

    const res = await fetch(`${BASE}/v2/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "invoice/create",
          status: res.status,
          message: data?.message || "Invoice үүсгэхэд алдаа гарлаа.",
          raw: data,
          sent: payload,
        },
        { status: res.status }
      );
    }

    // QPay invoice response дээр `qPay_deeplink` (array) ирдэг. Бид UI-д `urls` болгож хувиргана.
    const urls = Array.isArray(data?.qPay_deeplink)
      ? data.qPay_deeplink.map((x: any) => ({
          name: x?.name,
          description: x?.description,
          link: x?.link,
          logo: x?.logo,
        }))
      : [];

    return NextResponse.json(
      {
        ok: true,
        invoice_id: data?.invoice_id,
        qr_text: data?.qr_text,
        qr_image: data?.qr_image, // raw
        qr_image_dataurl: toDataUrlMaybe(data?.qr_image), // ✅ UI-д шууд ашиглана
        qPay_shortUrl: data?.qPay_shortUrl,
        urls, // ✅ UI-д шууд ашиглана
        raw: data,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "CREATE_INVOICE_EXCEPTION", message: e?.message || "create-invoice алдаа" },
      { status: 500 }
    );
  }
}
