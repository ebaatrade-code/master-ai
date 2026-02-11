// FILE: app/api/qpay/create-invoice/route.ts
import { NextResponse } from "next/server";
import { qpayCreateInvoice, extractShortUrl, toDataUrlPng, type QPayInvoiceCreateReq } from "@/lib/qpay";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isAmount(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0 && x < 1_000_000_000;
}

export async function POST(req: Request) {
  try {
    const siteUrl = mustEnv("SITE_URL");
    const invoiceCode = mustEnv("QPAY_INVOICE_CODE");
    const receiverCode = mustEnv("QPAY_INVOICE_RECEIVER_CODE");
    const branchCode = process.env.QPAY_BRANCH_CODE || "ONLINE";

    const json = (await req.json().catch(() => null)) as
      | { amount?: unknown; description?: unknown; courseId?: unknown; uid?: unknown; orderId?: unknown; senderInvoiceNo?: unknown }
      | null;

    if (!json) return noStoreJson({ error: "Invalid JSON" }, 400);

    const amount = typeof json.amount === "string" ? Number(json.amount) : json.amount;
    if (!isAmount(amount)) return noStoreJson({ error: "Invalid amount" }, 400);

    const description = String(json.description ?? "Master AI payment").trim();
    if (description.length < 2 || description.length > 140) return noStoreJson({ error: "Invalid description" }, 400);

    // unique sender_invoice_no — таны screenshot дээр энэ хадгалагдаж байна
    const senderInvoiceNoRaw = String(json.senderInvoiceNo ?? json.orderId ?? Date.now());
    const sender_invoice_no = senderInvoiceNoRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || String(Date.now());

    const orderId = String(json.orderId ?? sender_invoice_no).slice(0, 80);

    // callback_url — QPay төлөгдсөний дараа энэ endpoint руу цохино
    const callback_url =
      `${siteUrl.replace(/\/$/, "")}/api/qpay/callback` +
      `?orderId=${encodeURIComponent(orderId)}` +
      `&courseId=${encodeURIComponent(String(json.courseId ?? ""))}` +
      `&uid=${encodeURIComponent(String(json.uid ?? ""))}`;

    const payload: QPayInvoiceCreateReq = {
      invoice_code: invoiceCode,
      sender_invoice_no,
      invoice_receiver_code: receiverCode,
      sender_branch_code: branchCode,
      invoice_description: description,
      amount,
      callback_url,
      allow_partial: false,
      allow_exceed: false,
      enable_expiry: "false",
      minimum_amount: null,
      maximum_amount: null,
    };

    const inv = await qpayCreateInvoice(payload);

    return noStoreJson({
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text ?? null,
      qrImageBase64: inv.qr_image ?? null,
      qrImageDataUrl: toDataUrlPng(inv.qr_image ?? null),
      urls: Array.isArray(inv.urls) ? inv.urls : [],
      shortUrl: extractShortUrl(inv.urls),
      amount,
      description,
      senderInvoiceNo: sender_invoice_no,
      orderId,
      callbackUrl: callback_url,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ error: msg }, 500);
  }
}