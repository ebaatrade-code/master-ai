import { NextResponse } from "next/server";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const purchaseId = url.searchParams.get("pid");
  const body = await req.json();

  // QPay webhook payload хэлбэр янз бүр байж болно.
  // Ихэнхдээ payment_id / invoice_id ирдэг.
  const paymentId = body?.payment_id ?? body?.paymentId ?? null;
  const invoiceId = body?.invoice_id ?? body?.invoiceId ?? null;

  if (!purchaseId) return NextResponse.json({ ok: true });

  // purchases -> PAID болгож тэмдэглэнэ
  await updateDoc(doc(db, "purchases", purchaseId), {
    status: "PAID",
    paymentId,
    invoiceId,
    paidAt: new Date(),
  });

  // ⚠️ userId/courseId-г webhook-оос олдохгүй тул purchases doc дээрээс унших ёстой.
  // (Webhook дээр Firestore read хийхийн тулд Admin SDK хэрэгтэй. Чи одоогоор client SDK ашиглаж байгаа тул webhook-ыг түр алгасаад polling ашиглая.)
  // Иймээс webhook-г одоохондоо OK гэж буцаагаад, unlock-ыг polling дээр хийнэ.

  return NextResponse.json({ ok: true });
}
