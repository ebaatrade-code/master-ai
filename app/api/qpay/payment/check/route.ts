// app/api/qpay/payment/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { qpayPaymentCheck } from "@/lib/qpay";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { invoiceId: string };
    if (!body?.invoiceId) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const data = await qpayPaymentCheck(body.invoiceId);

    const paid =
      Array.isArray(data?.rows) && data.rows.some((r) => r.payment_status === "PAID");

    return NextResponse.json({ ok: true, paid, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
