// app/api/qpay/invoice/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { qpayCreateInvoice } from "@/lib/qpay";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      amount: number;
      description: string;
      orderNo?: string;
      callbackUrl?: string;
    };

    if (!Number.isFinite(body?.amount) || body.amount <= 0) {
      return NextResponse.json({ ok: false, error: "BAD_AMOUNT" }, { status: 400 });
    }
    if (!body?.description) {
      return NextResponse.json({ ok: false, error: "NO_DESCRIPTION" }, { status: 400 });
    }

    const orderNo = body.orderNo || `ORDER_${Date.now()}`;

    const invoice = await qpayCreateInvoice({
      orderNo,
      amount: body.amount,
      description: body.description,
      callbackUrl: body.callbackUrl, // optional
    });

    return NextResponse.json({ ok: true, orderNo, ...invoice });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
