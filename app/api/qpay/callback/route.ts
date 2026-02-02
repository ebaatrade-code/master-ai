// app/api/qpay/callback/route.ts
import { NextResponse } from "next/server";

// ⚠️ Энд бол "амжилттай/амжилтгүй" төлбөрийн дохио ирэхэд
// бид өөрсдөө дараа нь payment/check хийж баталгаажуулна.
// Одоохондоо зөвхөн SUCCESS буцаагаад байна.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // QPay зарим үед qpay_payment_id эсвэл бусад параметр явуулдаг.
  const qpay_payment_id = searchParams.get("qpay_payment_id");
  const orderId = searchParams.get("orderId");

  // энд хүсвэл Firestore дээр "callback received" лог хадгалж болно.

  return new NextResponse("SUCCESS", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
