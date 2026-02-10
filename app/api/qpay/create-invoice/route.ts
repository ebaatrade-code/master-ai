// FILE: app/api/qpay/create-invoice/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCreateInvoice } from "@/lib/qpay";
import * as admin from "firebase-admin";

export const dynamic = "force-dynamic";

type ReqBody = {
  courseId: string;
};

function required(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    const idToken = getBearer(req);
    if (!idToken) return jsonError("Missing Authorization: Bearer <firebase_id_token>", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = (await req.json()) as ReqBody;
    const courseId = (body?.courseId || "").trim();
    if (!courseId) return jsonError("courseId is required", 400);

    const db = adminDb();

    // ✅ Course price-г server-side авна (client hardcode хийхгүй)
    const courseRef = db.collection("courses").doc(courseId);
    const courseSnap = await courseRef.get();
    if (!courseSnap.exists) return jsonError("Course not found", 404);

    const course = courseSnap.data() as any;
    const title = String(course?.title || "Course");
    const price = Number(course?.price);

    if (!Number.isFinite(price) || price <= 0) return jsonError("Invalid course price", 500);

    // ✅ Invoice code (QPay-ээс олгосон)
    const invoiceCode = required("QPAY_INVOICE_CODE", process.env.QPAY_INVOICE_CODE);

    // ✅ Callback base url (prod domain)
    const callbackBase = required("QPAY_CALLBACK_BASE_URL", process.env.QPAY_CALLBACK_BASE_URL);
    const senderInvoiceNo = `c_${courseId}_${uid}_${Date.now()}`.slice(0, 64);

    // Firestore дээр invoice doc ID-г урьдчилж үүсгэж idempotent болгоно
    const invRef = db.collection("qpayInvoices").doc();
    const invoiceDocId = invRef.id;

    const callbackUrl =
      `${callbackBase.replace(/\/+$/, "")}/api/qpay/callback` +
      `?invoiceDocId=${encodeURIComponent(invoiceDocId)}`;

    // ✅ QPay invoice create
    const inv = await qpayCreateInvoice({
      invoice_code: invoiceCode,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: "terminal",
      invoice_description: `${title} (${courseId})`,
      amount: price,
      callback_url: callbackUrl,
      sender_branch_code: "ONLINE",
      allow_partial: false,
      allow_exceed: false,
      enable_expiry: false,
      note: null,
      invoice_receiver_data: {
        name: String(course?.receiverName || ""),
        email: String(course?.receiverEmail || ""),
        phone: String(course?.receiverPhone || ""),
      },
    });

    // ✅ Save invoice data
    await invRef.set(
      {
        uid,
        courseId,
        courseTitle: title,
        amount: price,
        status: "PENDING",
        qpayInvoiceId: inv.invoice_id,
        qrText: inv.qr_text,
        qrImageBase64: inv.qr_image ?? null,
        shortUrl: inv.qPay_shortUrl ?? null,
        urls: inv.urls ?? [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAt: null,
        finalizedAt: null,
      },
      { merge: false }
    );

    return NextResponse.json({
      ok: true,
      invoiceDocId,
      qpayInvoiceId: inv.invoice_id,
      amount: price,
      courseId,
      courseTitle: title,
      qr_text: inv.qr_text,
      qr_image: inv.qr_image ?? null,
      shortUrl: inv.qPay_shortUrl ?? null,
      urls: inv.urls ?? [],
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    // token invalid гэх мэт
    const status = msg.toLowerCase().includes("id token") ? 401 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}