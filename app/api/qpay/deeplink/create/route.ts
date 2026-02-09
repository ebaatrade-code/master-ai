// app/api/qpay/deeplink/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { qpayCreateInvoice } from "@/lib/qpay";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      courseId: string;
      amount: number;
      title?: string;
      orderNo?: string;
    };

    if (!body?.courseId || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const orderNo = body.orderNo || `ORDER_${Date.now()}`;
    const description = body.title || `Course purchase: ${body.courseId}`;

    // ⚠️ локал дээр callbackUrl public биш тул placeholder байж болно
    const invoice = await qpayCreateInvoice({
      orderNo,
      amount: body.amount,
      description,
      callbackUrl: "https://example.com/qpay/callback",
    });

    return NextResponse.json({
      ok: true,
      orderNo,
      ...invoice,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
