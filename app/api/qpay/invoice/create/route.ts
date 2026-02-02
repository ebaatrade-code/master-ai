// app/api/qpay/invoice/create/route.ts
import { NextResponse } from "next/server";
import { qpayCreateInvoice } from "@/lib/qpay";

type Body = {
  orderId: string;
  amount: number;
  description: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.orderId || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const base = process.env.QPAY_CALLBACK_BASE || "http://localhost:3000";
    const callback_url = `${base}/api/qpay/callback?orderId=${encodeURIComponent(body.orderId)}`;

    const inv = await qpayCreateInvoice({
      sender_invoice_no: body.orderId,
      invoice_description: body.description,
      amount: body.amount,
      callback_url,
    });

    return NextResponse.json({ ok: true, invoice: inv });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN" },
      { status: 500 }
    );
  }
}
