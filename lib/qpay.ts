// lib/qpay.ts
type TokenRes = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

export type InvoiceCreateRes = {
  invoice_id?: string;
  qr_text?: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: Array<{ name: string; description?: string; link: string; logo?: string }>;
};

export type PaymentCheckRes = {
  count?: number;
  paid_amount?: number;
  rows?: Array<{
    payment_id: string;
    payment_status: "PAID" | "PENDING" | string;
    payment_amount: string;
    payment_currency: string;
    payment_date?: string;
    payment_wallet?: string;
    payment_type?: string;
  }>;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV missing: ${name}`);
  return v;
}

const BASE_URL = () => mustEnv("QPAY_BASE_URL").replace(/\/$/, "");
const CLIENT_ID = () => mustEnv("QPAY_CLIENT_ID");
const CLIENT_SECRET = () => mustEnv("QPAY_CLIENT_SECRET");
export const INVOICE_CODE = () => mustEnv("QPAY_INVOICE_CODE");

export async function qpayGetToken() {
  const url = `${BASE_URL()}/v2/auth/token`;

  // QPay token endpoint: Basic Auth
  const basic = Buffer.from(`${CLIENT_ID()}:${CLIENT_SECRET()}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    // зарим sandbox/merchant дээр body шаардлагагүй байдаг
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPAY_TOKEN_ERROR ${res.status}: ${text}`);
  }

  const data = (await res.json()) as TokenRes;
  if (!data?.access_token) throw new Error("QPAY_TOKEN_INVALID_RESPONSE");
  return data.access_token;
}

export async function qpayCreateInvoice(input: {
  sender_invoice_no: string;
  invoice_description: string;
  amount: number;
  callback_url: string;
  invoice_receiver_code?: string; // terminal гэх мэт
  sender_branch_code?: string; // ONLINE гэх мэт
}) {
  const token = await qpayGetToken();
  const url = `${BASE_URL()}/v2/invoice`;

  const body = {
    invoice_code: INVOICE_CODE(),
    sender_invoice_no: input.sender_invoice_no,
    invoice_receiver_code: input.invoice_receiver_code ?? "terminal",
    invoice_description: input.invoice_description,
    sender_branch_code: input.sender_branch_code ?? "ONLINE",
    amount: input.amount,
    callback_url: input.callback_url,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPAY_CREATE_INVOICE_ERROR ${res.status}: ${text}`);
  }

  return (await res.json()) as InvoiceCreateRes;
}

export async function qpayPaymentCheck(invoice_id: string) {
  const token = await qpayGetToken();
  const url = `${BASE_URL()}/v2/payment/check`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ object_type: "INVOICE", object_id: invoice_id }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPAY_PAYMENT_CHECK_ERROR ${res.status}: ${text}`);
  }

  return (await res.json()) as PaymentCheckRes;
}
