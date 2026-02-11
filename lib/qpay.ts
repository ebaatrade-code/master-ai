// FILE: lib/qpay.ts
import { fetchJson } from "@/lib/http";

const QPAY_BASE = "https://merchant.qpay.mn/v2";

type TokenResp = {
  access_token: string;
  expires_in?: number; // seconds (зарим үед байхгүй)
};

export type QPayUrl = {
  name: string;
  description?: string;
  link: string;
  logo?: string;
};

export type QPayInvoiceCreateReq = {
  invoice_code: string;
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  sender_branch_code?: string;
  amount: number;
  callback_url: string;
  allow_partial?: boolean;
  allow_exceed?: boolean;
  enable_expiry?: string | boolean;
  minimum_amount?: number | null;
  maximum_amount?: number | null;
};

export type QPayInvoiceCreateResp = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string; // base64 PNG
  urls?: QPayUrl[];
};

type PaymentCheckReq = {
  object_type: "INVOICE";
  object_id: string;
  offset?: { page_number: number; page_limit: number };
};

type PaymentCheckResp = {
  rows?: Array<{
    payment_id?: string;
    payment_status?: string; // PAID гэх мэт
    payment_amount?: number;
    paid_amount?: number;
    payment_date?: string;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __qpay_token_cache__:
    | { token: string; expMs: number }
    | undefined;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function getQPayAccessToken(): Promise<string> {
  const now = Date.now();
  const cached = globalThis.__qpay_token_cache__;
  if (cached && cached.expMs > now + 30_000) return cached.token;

  const clientId = env("QPAY_CLIENT_ID");
  const clientSecret = env("QPAY_CLIENT_SECRET");

  const data = await fetchJson<TokenResp>(`${QPAY_BASE}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
    },
    timeoutMs: 15000,
  });

  if (!data?.access_token) throw new Error("QPay token missing access_token");

  const expSec =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 1800; // fallback 30min

  globalThis.__qpay_token_cache__ = {
    token: data.access_token,
    expMs: now + expSec * 1000,
  };

  return data.access_token;
}

export async function qpayCreateInvoice(
  input: QPayInvoiceCreateReq
): Promise<QPayInvoiceCreateResp> {
  const token = await getQPayAccessToken();

  const resp = await fetchJson<QPayInvoiceCreateResp>(`${QPAY_BASE}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    timeoutMs: 20000,
  });

  if (!resp?.invoice_id) throw new Error("QPay invoice create failed: missing invoice_id");

  return resp;
}

export async function qpayCheckInvoicePaid(invoiceId: string): Promise<{
  paid: boolean;
  raw: PaymentCheckResp;
}> {
  const token = await getQPayAccessToken();

  const body: PaymentCheckReq = {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  };

  const resp = await fetchJson<PaymentCheckResp>(`${QPAY_BASE}/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    timeoutMs: 20000,
  });

  const rows = Array.isArray(resp?.rows) ? resp.rows : [];
  const paid = rows.some((r) => {
    const s = String(r?.payment_status || "").toUpperCase();
    return s === "PAID" || s === "SUCCESS" || s === "CONFIRMED";
  });

  return { paid, raw: resp };
}

export function extractShortUrl(urls: QPayUrl[] | undefined | null): string | null {
  if (!Array.isArray(urls)) return null;
  const found = urls.find((u) => typeof u?.link === "string" && /qpay\.mn\/s\//i.test(u.link));
  return found?.link || null;
}

export function toDataUrlPng(base64Png: string | null | undefined): string | null {
  if (!base64Png) return null;
  // qpay qr_image нь base64 PNG байдаг
  return `data:image/png;base64,${base64Png}`;
}