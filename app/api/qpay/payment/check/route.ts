import { NextResponse } from "next/server";
import { qpayCheckPayment } from "@/lib/qpay";

type Body = { paymentId: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.paymentId) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const data = await qpayCheckPayment(body.paymentId);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
