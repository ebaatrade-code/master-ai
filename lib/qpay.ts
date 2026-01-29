export type QPayDeeplink = {
  name?: string;
  description?: string;
  link: string;
};

export type QPayInvoiceResp = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  urls?: QPayDeeplink[];
};

type QPayTokenResp = {
  access_token?: string;
  expires_in?: number;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function base() {
  const b = process.env.QPAY_BASE_URL;
  if (!b) throw new Error("QPAY_BASE_URL missing");
  return b.replace(/\/$/, "");
}

async function getToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const clientId = process.env.QPAY_CLIENT_ID;
  const secret = process.env.QPAY_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("QPAY_CLIENT_ID/SECRET missing");

  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${base()}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`QPay token failed: ${res.status} ${t}`);
  }

  const data = (await res.json()) as QPayTokenResp;
  if (!data.access_token) throw new Error("QPay token missing access_token");

  const ttl = (data.expires_in ?? 3000) * 1000;
  cachedToken = { value: data.access_token, expiresAt: now + ttl - 30_000 };

  return data.access_token;
}

export async function qpayCreateInvoice(input: {
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: number;
  callback_url: string;
}): Promise<QPayInvoiceResp> {
  const invoice_code = process.env.QPAY_INVOICE_CODE;
  if (!invoice_code) throw new Error("QPAY_INVOICE_CODE missing");

  const token = await getToken();

  const res = await fetch(`${base()}/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code,
      sender_invoice_no: input.sender_invoice_no,
      invoice_receiver_code: input.invoice_receiver_code,
      invoice_description: input.invoice_description,
      amount: input.amount,
      callback_url: input.callback_url,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`QPay create invoice failed: ${res.status} ${t}`);
  }

  return (await res.json()) as QPayInvoiceResp;
}

export async function qpayCheckInvoice(invoiceId: string) {
  const token = await getToken();

  const res = await fetch(`${base()}/payment/check`, {
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
    const t = await res.text();
    throw new Error(`QPay check failed: ${res.status} ${t}`);
  }

  return (await res.json()) as {
    count: number;
    paid_amount: number;
    rows: Array<{
      payment_id: string;
      payment_status: "NEW" | "FAILED" | "PAID" | "REFUNDED";
      payment_date: string;
      payment_amount: string;
      payment_currency: string;
    }>;
  };
}
