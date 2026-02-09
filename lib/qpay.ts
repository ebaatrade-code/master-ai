// lib/qpay.ts
type TokenRes = { access_token: string };

type InvoiceCreateRes = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: Array<{ name: string; description?: string; link: string; logo?: string }>;
};

type PaymentCheckRes = {
  count?: number;
  paid_amount?: number;
  rows?: Array<{
    payment_id: string;
    payment_status: "PAID" | "PENDING" | string;
    payment_amount: string;
    payment_currency: string;
    payment_date?: string;
  }>;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV missing: ${name}`);
  return v;
}

const BASE_URL = () => mustEnv("QPAY_BASE_URL");
const CLIENT_ID = () => mustEnv("QPAY_CLIENT_ID");
const CLIENT_SECRET = () => mustEnv("QPAY_CLIENT_SECRET");
const INVOICE_CODE = () => mustEnv("QPAY_INVOICE_CODE");
const BRANCH_CODE = () => process.env.QPAY_BRANCH_CODE || "ONLINE";

async function qpayToken() {
  const basic = Buffer.from(`${CLIENT_ID()}:${CLIENT_SECRET()}`).toString("base64");

  const res = await fetch(`${BASE_URL()}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });

  if (!res.ok) throw new Error(`QPAY_TOKEN_FAILED: ${res.status}`);
  const json = (await res.json()) as TokenRes;
  if (!json?.access_token) throw new Error("QPAY_TOKEN_NO_ACCESS_TOKEN");
  return json.access_token;
}

export async function qpayCreateInvoice(input: {
  orderNo: string;
  amount: number;
  description: string;
  callbackUrl?: string; // локал дээр optional
}) {
  const token = await qpayToken();

  const body = {
    invoice_code: INVOICE_CODE(),
    sender_invoice_no: input.orderNo,
    invoice_receiver_code: "terminal",
    invoice_description: input.description,
    sender_branch_code: BRANCH_CODE(),
    amount: input.amount,
    callback_url: input.callbackUrl || "https://example.com/qpay/callback",
  };

  const res = await fetch(`${BASE_URL()}/v2/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`QPAY_INVOICE_FAILED: ${res.status} ${t}`);
  }

  return (await res.json()) as InvoiceCreateRes;
}

export async function qpayPaymentCheck(invoiceId: string) {
  const token = await qpayToken();

  const res = await fetch(`${BASE_URL()}/v2/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`QPAY_CHECK_FAILED: ${res.status} ${t}`);
  }

  return (await res.json()) as PaymentCheckRes;
}
