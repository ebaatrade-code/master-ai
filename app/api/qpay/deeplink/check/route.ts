import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { qpayCheckInvoice } from "@/lib/qpay";
import { FieldValue } from "firebase-admin/firestore";

type Body = { orderId: string };

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = (await req.json()) as Body;
    if (!body?.orderId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

    const ref = adminDb.collection("purchases").doc(body.orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const order = snap.data()!;
    if (order.uid !== uid) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    if (order.status === "paid") {
      return NextResponse.json({ status: "PAID", courseId: order.courseId });
    }

    const invoiceId = order.qpay?.invoiceId;
    if (!invoiceId) return NextResponse.json({ error: "MISSING_INVOICE" }, { status: 400 });

    const check = await qpayCheckInvoice(invoiceId);
    const paidRow = (check.rows || []).find((r) => r.payment_status === "PAID");

    if (!paidRow) {
      await ref.update({ updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ status: "PENDING" });
    }

    // ✅ PAID → purchases paid + user purchasedCourseIds нэмнэ
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

    await adminDb.collection("users").doc(uid).set(
      {
        purchasedCourseIds: FieldValue.arrayUnion(order.courseId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ status: "PAID", courseId: order.courseId });
  } catch (e: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e?.message || "unknown" },
      { status: 500 }
    );
  }
}
