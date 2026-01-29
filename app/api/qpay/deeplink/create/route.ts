import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { qpayCreateInvoice } from "@/lib/qpay";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  courseId: string;
  amount: number;
  title?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = (await req.json()) as Body;
    if (!body?.courseId || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    // ✅ orderId
    const orderRef = adminDb.collection("purchases").doc();
    const orderId = orderRef.id;

    // ✅ Домэйнгүй үед callback нь ажиллахгүй байж болно — асуудалгүй (check ашиглана)
    const callback_url = `${appUrl}/api/qpay/deeplink/callback?orderId=${orderId}`;

    const invoice = await qpayCreateInvoice({
      sender_invoice_no: orderId,
      invoice_receiver_code: uid,
      invoice_description: body.title ? `Course: ${body.title}` : "Course purchase",
      amount: body.amount,
      callback_url,
    });

    await orderRef.set({
      uid,
      courseId: body.courseId,
      amount: body.amount,
      status: "pending",
      qpay: {
        invoiceId: invoice.invoice_id,
        urls: invoice.urls || [],
        qr_text: invoice.qr_text || null,
        qr_image: invoice.qr_image || null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      orderId,
      invoiceId: invoice.invoice_id,
      urls: invoice.urls || [],
      qr_image: invoice.qr_image || null, // хүсвэл fallback
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e?.message || "unknown" },
      { status: 500 }
    );
  }
}
