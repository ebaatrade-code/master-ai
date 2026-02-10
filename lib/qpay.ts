// FILE: lib/qpay.ts
export type QPayInvoiceCreateResponse = {
  invoice_id: string;
  qr_text: string;
  qr_image?: string; // base64 png (зарим мерчант дээр ирдэг)
  qPay_shortUrl?: string;
  urls?: Array<{
    name?: string;
    description?: string;
    logo?: string;
    link: string;
  }>;
};

type QPayTokenResponse = {
  token_type?: string;
  access_token: string;
  expires_in?: number;
};

type QPayPaymentCheckResponse = {
  count?: number;
  rows?: any[];
};

type Cache = { token?: string; expiresAtMs?: number };
const cache: Cache = {};

function required(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function baseUrl() {
  return process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2";
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function getQPayAccessToken(): Promise<string> {
  const clientId = required("QPAY_CLIENT_ID", process.env.QPAY_CLIENT_ID);
  const clientSecret = required("QPAY_CLIENT_SECRET", process.env.QPAY_CLIENT_SECRET);

  const now = Date.now();
  if (cache.token && cache.expiresAtMs && now < cache.expiresAtMs) return cache.token;

  const url = `${baseUrl()}/auth/token`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`QPay token failed (${res.status}): ${t}`);
  }

  const data = (await res.json()) as QPayTokenResponse;
  if (!data?.access_token) throw new Error("QPay token response missing access_token");

  // expires_in заримдаа асар урт тоо ирдэг (жилээр) — production дээр 50 минут гэж conservative cache хийнэ.
  const ttlSecRaw = data.expires_in ?? 3000;
  const ttlSec = Math.max(300, Math.min(3600, ttlSecRaw)); // 5–60 мин
  cache.token = data.access_token;
  cache.expiresAtMs = Date.now() + (ttlSec - 30) * 1000;

  return cache.token;
}

export async function qpayCreateInvoice(input: {
  invoice_code: string;
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: number;
  callback_url: string;
  sender_branch_code?: string;
  allow_partial?: boolean;
  allow_exceed?: boolean;
  enable_expiry?: boolean;
  note?: string | null;
  invoice_receiver_data?: {
    register?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}) {
  const token = await getQPayAccessToken();

  const res = await fetch(`${baseUrl()}/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code: input.invoice_code,
      sender_invoice_no: input.sender_invoice_no,
      invoice_receiver_code: input.invoice_receiver_code,
      sender_branch_code: input.sender_branch_code ?? "ONLINE",
      invoice_description: input.invoice_description,
      amount: input.amount,
      callback_url: input.callback_url,
      allow_partial: input.allow_partial ?? false,
      allow_exceed: input.allow_exceed ?? false,
      enable_expiry: String(input.enable_expiry ?? false),
      note: input.note ?? null,
      invoice_receiver_data: input.invoice_receiver_data ?? undefined,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`QPay invoice create failed (${res.status}): ${t}`);
  }

  const data = (await res.json()) as QPayInvoiceCreateResponse;

  if (!data?.invoice_id || !data?.qr_text) {
    throw new Error("QPay invoice response missing invoice_id/qr_text");
  }

  return data;
}

export async function qpayCheckPaymentByInvoice(invoiceId: string): Promise<{
  paid: boolean;
  raw: QPayPaymentCheckResponse;
}> {
  const token = await getQPayAccessToken();

  const res = await fetch(`${baseUrl()}/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`QPay payment check failed (${res.status}): ${t}`);
  }

  const raw = (await res.json()) as QPayPaymentCheckResponse;

  const count = typeof raw?.count === "number" ? raw.count : Array.isArray(raw?.rows) ? raw.rows.length : 0;
  const rows = Array.isArray(raw?.rows) ? raw.rows : [];

  // QPay мерчант бүрийн "rows" бүтэц өөр байж болдог:
  // хамгийн safe: rows length > 0 бол төлөгдсөн гэж үзнэ.
  const paid = count > 0 && rows.length > 0;

  return { paid, raw };
}