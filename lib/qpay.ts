// lib/qpay.ts

export type TokenRes = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

export type InvoiceCreateRes = {
  invoice_id?: string;
  qr_image?: string;
  qr_text?: string;
  qPay_shortUrl?: string;
  urls?: Array<{ name: string; description?: string; link: string }>;
};

export type PaymentCheckRes = {
  count?: number;
  paid_amount?: number;
  rows?: Array<{
    payment_id: string;
    payment_status: "PAID" | "PENDING" | string;
    payment_amount: number | string;
    payment_currency: string;
    payment_date?: string;
    payment_wallet?: string;
    payment_type?: string;
    trx_fee?: number | string;
  }>;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV missing: ${name}`);
  return v;
}

const BASE_URL = () => mustEnv("QPAY_BASE_URL"); // https://merchant.qpay.mn
const CLIENT_ID = () => mustEnv("QPAY_CLIENT_ID");
const CLIENT_SECRET = () => mustEnv("QPAY_CLIENT_SECRET");
const INVOICE_CODE = () => mustEnv("QPAY_INVOICE_CODE");
const CALLBACK_URL = () => mustEnv("QPAY_CALLBACK_URL");

const SENDER_BRANCH_CODE = () => process.env.QPAY_SENDER_BRANCH_CODE || "ONLINE";
const INVOICE_RECEIVER_CODE = () =>
  process.env.QPAY_INVOICE_RECEIVER_CODE || "terminal";

// ✅ 1) Token авах
export async function qpayGetToken(): Promise<TokenRes> {
  const url = `${BASE_URL()}/v2/auth/token`;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", CLIENT_ID());
  body.set("client_secret", CLIENT_SECRET());

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`QPAY token failed: ${res.status} ${t}`);
  }

  return (await res.json()) as TokenRes;
}

// ✅ 2) Invoice үүсгэх (callback_url type асуудалгүй — env-ээс өгч байна)
export async function qpayCreateInvoice(params: {
  sender_invoice_no: string; // ORDER_10001 гэх мэт
  invoice_description: string; // "Master AI сургалт" гэх мэт
  amount: number; // 1000
}) {
  const token = await qpayGetToken();
  const url = `${BASE_URL()}/v2/invoice`;

  const payload = {
    invoice_code: INVOICE_CODE(),
    sender_invoice_no: params.sender_invoice_no,
    invoice_receiver_code: INVOICE_RECEIVER_CODE(),
    invoice_description: params.invoice_description,
    sender_branch_code: SENDER_BRANCH_CODE(),
    amount: params.amount,
    callback_url: CALLBACK_URL(), // ✅ энд л байна
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`QPAY create invoice failed: ${res.status} ${t}`);
  }

  return (await res.json()) as InvoiceCreateRes;
}

// ✅ 3) Payment шалгах
export async function qpayCheckPayment(paymentId: string) {
  const token = await qpayGetToken();
  const url = `${BASE_URL()}/v2/payment/check`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payment_id: paymentId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`QPAY check failed: ${res.status} ${t}`);
  }

  return (await res.json()) as PaymentCheckRes;
}

// ✅ Хуучин нэрээр дуудаж байсан route-ууд унахгүй (alias export)
export const qpayPaymentCheck = qpayCheckPayment;
