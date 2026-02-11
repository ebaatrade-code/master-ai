// FILE: app/api/qpay/deeplink/check/route.ts
import { NextResponse } from "next/server";
import { qpayCheckInvoicePaid } from "@/lib/qpay";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const json = (await req.json().catch(() => null)) as { qpayInvoiceId?: unknown; invoiceId?: unknown } | null;
    const invoiceId = String(json?.qpayInvoiceId ?? json?.invoiceId ?? "").trim();
    if (!invoiceId || invoiceId.length < 8) return noStoreJson({ error: "Invalid invoiceId" }, 400);

    const { paid, raw } = await qpayCheckInvoicePaid(invoiceId);
    return noStoreJson({ paid, raw });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ error: msg }, 500);
  }
}