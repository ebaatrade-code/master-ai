// app/api/qpay/deeplink/create/route.ts
import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCreateInvoice } from "@/lib/qpay";

export const dynamic = "force-dynamic";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

function envOrThrow(name: string) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const idToken = getBearerToken(req);
    if (!idToken) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) Body
    const body = (await req.json()) as { courseId: string; amount: number; title?: string };
    const courseId = String(body?.courseId ?? "").trim();
    const amount = Number(body?.amount);

    if (!courseId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // ✅ 3) invoice_code ENV-ээс
    const invoiceCode = envOrThrow("QPAY_INVOICE_CODE");

    // 4) Firestore order record
    const db = adminDb();

    // sender_invoice_no unique
    const senderInvoiceNo = `MAI_${uid}_${courseId}_${Date.now()}`;

    const ref = db.collection("qpayPayments").doc();
    await ref.set({
      uid,
      courseId,
      amount,
      status: "pending",
      senderInvoiceNo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5) callback url
    const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    const callbackUrl = `${baseUrl}/api/qpay/callback?ref=${ref.id}`;

    // 6) QPay invoice create
    const invoice = await qpayCreateInvoice({
      invoice_code: invoiceCode, // ✅ ЭНД MASTERAI_MN_INVOICE гэж БИЧИХГҮЙ
      sender_invoice_no: senderInvoiceNo,
      invoice_description: body.title ? `${body.title} төлбөр` : `Course ${courseId} төлбөр`,
      amount,
      callback_url: callbackUrl,
      invoice_receiver_code: "terminal",
      sender_branch_code: "MAIN",
      // sender_staff_code: ❌ БИЧИХГҮЙ (type error өгнө)
    });

    // 7) Save invoice result
    await ref.set(
      {
        invoiceId: invoice.invoice_id,
        qpayShortUrl: invoice.qPay_shortUrl ?? null,
        qrText: invoice.qr_text ?? null,
        qrImageBase64: invoice.qr_image ?? null,
        urls: invoice.urls ?? [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 8) Return
    return NextResponse.json({
      orderId: ref.id,
      invoiceId: invoice.invoice_id,
      shortUrl: invoice.qPay_shortUrl ?? null,
      qrText: invoice.qr_text ?? null,
      qrImageBase64: invoice.qr_image ?? null,
      urls: invoice.urls ?? [],
    });
  } catch (e: any) {
    console.error("QPAY deeplink/create error:", e);
    return NextResponse.json(
      { error: typeof e?.message === "string" ? e.message : "Server error" },
      { status: 500 }
    );
  }
}