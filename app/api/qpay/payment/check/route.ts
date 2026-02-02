// app/api/qpay/payment/check/route.ts
import { NextResponse } from "next/server";
import { qpayPaymentCheck } from "@/lib/qpay";

type Body = { invoiceId: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.invoiceId) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const data = await qpayPaymentCheck(body.invoiceId);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN" },
      { status: 500 }
    );
  }
}
