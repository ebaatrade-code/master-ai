import { NextResponse } from "next/server";
import { qpayCreateInvoice } from "@/lib/qpay";

type Body = {
  sender_invoice_no: string;
  invoice_description: string;
  amount: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.sender_invoice_no || !body?.invoice_description || !Number.isFinite(body.amount)) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const data = await qpayCreateInvoice({
      sender_invoice_no: body.sender_invoice_no,
      invoice_description: body.invoice_description,
      amount: body.amount,
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
