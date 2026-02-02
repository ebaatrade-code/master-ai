type TokenRes = { access_token: string };

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV missing: ${name}`);
  return v;
}

const BASE = () => mustEnv("QPAY_BASE_URL"); // sandbox/prod
const USER = () => mustEnv("QPAY_USERNAME");
const PASS = () => mustEnv("QPAY_PASSWORD");

async function getAccessToken(): Promise<string> {
  const basic = Buffer.from(`${USER()}:${PASS()}`).toString("base64");

  const res = await fetch(`${BASE()}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });

  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`TOKEN_ERROR: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function qpayCreateInvoice(body: any) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE()}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`INVOICE_ERROR: ${JSON.stringify(data)}`);
  return data;
}

export async function qpayCheckPaymentByInvoice(invoiceId: string) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE()}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PAYMENT_CHECK_ERROR: ${JSON.stringify(data)}`);
  return data;
}
