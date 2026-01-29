import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { qpayCheckInvoice } from "@/lib/qpay";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ ok: false, error: "MISSING_ORDER" }, { status: 400 });

    const ref = adminDb.collection("purchases").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const order = snap.data()!;
    if (order.status === "paid") return NextResponse.json({ ok: true, status: "PAID" });

    const invoiceId = order.qpay?.invoiceId;
    if (!invoiceId) return NextResponse.json({ ok: false, error: "MISSING_INVOICE" }, { status: 400 });

    const check = await qpayCheckInvoice(invoiceId);
    const paidRow = (check.rows || []).find((r) => r.payment_status === "PAID");
    if (!paidRow) return NextResponse.json({ ok: true, status: "PENDING" });

    await ref.update({
      status: "paid",
      payment: {
        paymentId: paidRow.payment_id,
        paidAt: paidRow.payment_date,
        amount: paidRow.payment_amount,
        currency: paidRow.payment_currency,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("users").doc(order.uid).set(
      {
        purchasedCourseIds: FieldValue.arrayUnion(order.courseId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, status: "PAID" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}
