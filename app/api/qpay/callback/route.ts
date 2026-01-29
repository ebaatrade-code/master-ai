import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * QPay төлбөр төлөгдөхөд callback_url руу чинь серверээс server-side hit хийнэ.
 * QPay яг ямар body явуулдгийг мерчант бүр өөр хувилбар байж болох тул:
 * - бид бүх body/query-г авч log маягаар raw буцаадаг болголоо.
 *
 * Прод дээр чи эндээс invoice_id аваад:
 * 1) /v2/payment/check хийнэ
 * 2) paid бол Firestore дээр purchasedCourseIds update хийнэ
 */

export async function POST(req: Request) {
  try {
    const bodyText = await req.text(); // ямар ч payload байсан алдахгүй
    return NextResponse.json(
      { ok: true, receivedAt: new Date().toISOString(), bodyText },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  // Заримдаа QPay GET-ээр ping хийж магадгүй, тиймээс safe болголоо
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return NextResponse.json({ ok: true, params }, { status: 200 });
}
