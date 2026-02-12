// FILE: app/api/qpay/callback/route.ts
import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function ok() {
  return noStoreJson({ ok: true }, 200);
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// ---- token cache ----
let cachedAccessToken: { token: string; expMs: number } | null = null;

async function getQPayAccessToken(): Promise<string> {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const username = envOrThrow("QPAY_USERNAME");
  const password = envOrThrow("QPAY_PASSWORD");

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expMs > now + 30_000) return cachedAccessToken.token;

  const basic = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });

  if (!res.ok) return "NO_TOKEN";

  const data = (await res.json().catch(() => null)) as any;
  const token = String(data?.access_token || "").trim();
  if (!token) return "NO_TOKEN";

  const expiresSec =
    typeof data.expires_in === "number" && data.expires_in > 0 && data.expires_in < 86400 * 365 ? data.expires_in : 3600;

  cachedAccessToken = { token, expMs: now + expiresSec * 1000 };
  return token;
}

async function qpayCheckPaid(invoiceId: string) {
  const baseUrl = envOrThrow("QPAY_BASE_URL").replace(/\/+$/, "");
  const accessToken = await getQPayAccessToken();
  if (!accessToken || accessToken === "NO_TOKEN") return { ok: false, paid: false, detail: { message: "No token" } };

  const res = await fetch(`${baseUrl}/v2/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ object_type: "INVOICE", object_id: invoiceId }),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) return { ok: false, paid: false, detail: data };

  const status = String(data?.payment_status || data?.status || data?.invoice_status || "").toUpperCase();
  const paidAmount = Number(data?.paid_amount ?? data?.paidAmount ?? 0);
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.payments) ? data.payments : [];
  const anyRowPaid = rows.some((r: any) => String(r?.payment_status || r?.status || "").toUpperCase() === "PAID");

  const paid = status === "PAID" || paidAmount > 0 || anyRowPaid;
  return { ok: true, paid, detail: data };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const ref = String(searchParams.get("ref") || "").trim();
    const secret = String(searchParams.get("s") || "").trim();
    const must = (process.env.QPAY_CALLBACK_SECRET || "").trim();

    // secret тохируулсан бол заавал таарна
    if (must && secret !== must) return ok();

    if (!ref) return ok();

    const db = adminDb();
    const payRef = db.collection("qpayPayments").doc(ref);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return ok();

    const pay = paySnap.data() as any;
    const invoiceId = String(pay?.qpayInvoiceId || "").trim();
    if (!invoiceId) return ok();

    // already paid
    if (pay?.paid === true || String(pay?.status || "").toLowerCase() === "paid") return ok();

    const check = await qpayCheckPaid(invoiceId);
    if (!check.ok || !check.paid) return ok();

    // mark paid (grant-г client check route хийнэ; callback нь зөвхөн paid болгож өгнө)
    await payRef.set(
      {
        paid: true,
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        callbackAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return ok();
  } catch {
    return ok();
  }
}

export async function POST(req: Request) {
  // callback дээр ихэвчлэн GET ирдэг, POST fallback
  return GET(req);
}