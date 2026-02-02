import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // ✅ Debug: Vercel logs дээр харагдана
    console.log("QPAY CALLBACK:", JSON.stringify(payload));

    // TODO: эндээс orderNo / payment_id авч Firestore update хийж болно.
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("QPAY CALLBACK ERROR:", e?.message);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
