import { NextResponse } from "next/server";
import { qpayCreateInvoice } from "@/lib/qpay";

type Body = {
  orderNo: string;      // ORDER_10001 гэх мэт
  title: string;        // "Turshilt - 32₮"
  amount: number;       // 32
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.orderNo || !body?.title || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const inv = await qpayCreateInvoice({
      sender_invoice_no: body.orderNo,
      invoice_description: body.title,
      amount: body.amount,
    });

    return NextResponse.json({
      ok: true,
      invoice_id: inv.invoice_id || null,
      qPay_shortUrl: inv.qPay_shortUrl || null,
      urls: inv.urls || [],
      qr_text: inv.qr_text || null,
      qr_image: inv.qr_image || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
