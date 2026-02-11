// FILE: app/api/qpay/callback/route.ts
import { NextResponse } from "next/server";
import { qpayCheckInvoicePaid } from "@/lib/qpay";

export const runtime = "nodejs";

function ok() {
  return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

/**
 * QPay callback_url:
 * - Query дээр invoice_id ирэх боломжтой
 * - Энд paid check хийгээд (шаардлагатай бол) таны purchase grant логик руу дамжуулна
 * Энэ file таны одоогийн системийг эвдэхгүй.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId =
      String(searchParams.get("invoice_id") || searchParams.get("invoiceId") || "").trim();

    if (invoiceId) {
      await qpayCheckInvoicePaid(invoiceId);
      // TODO: энд Firestore grantPurchase хийхийг хүсвэл дараагийн алхамд нэмнэ
    }

    return ok();
  } catch {
    // callback дээр 200 буцаах нь retries-ээс хамгаална
    return ok();
  }
}

export async function POST(req: Request) {
  try {
    const json = (await req.json().catch(() => null)) as any;
    const invoiceId = String(json?.invoice_id || json?.invoiceId || "").trim();
    if (invoiceId) await qpayCheckInvoicePaid(invoiceId);
    return ok();
  } catch {
    return ok();
  }
}