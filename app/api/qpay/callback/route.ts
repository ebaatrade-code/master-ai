// FILE: app/api/qpay/callback/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCheckPaymentByInvoice } from "@/lib/qpay";
import * as admin from "firebase-admin";

export const dynamic = "force-dynamic";

/**
 * QPay callback_url дээр invoiceDocId query param тавьсан.
 * QPay яг ямар query/body явуулах нь мерчант config-с хамаарч өөр байж болно.
 * Тиймээс бид хамгийн найдвартайгаар:
 * - invoiceDocId-г авч Firestore-оос qpayInvoiceId-г уншаад
 * - payment/check API-р шалгаад paid бол finalize хийнэ.
 */

async function finalize(db: FirebaseFirestore.Firestore, invoiceDocId: string) {
  const invRef = db.collection("qpayInvoices").doc(invoiceDocId);

  await db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw new Error("Invoice not found");
    const inv = invSnap.data() as any;

    if (inv.status === "PAID" && inv.finalizedAt) return;

    const uid = String(inv.uid || "");
    const courseId = String(inv.courseId || "");
    const qpayInvoiceId = String(inv.qpayInvoiceId || "");
    const amount = Number(inv.amount || 0);

    if (!uid || !courseId || !qpayInvoiceId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invoice data incomplete");
    }

    const purchaseRef = db.collection("purchases").doc(qpayInvoiceId);
    const userRef = db.collection("users").doc(uid);

    const purchaseSnap = await tx.get(purchaseRef);
    if (!purchaseSnap.exists) {
      tx.set(
        purchaseRef,
        {
          uid,
          courseId,
          qpayInvoiceId,
          amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "qpay",
        },
        { merge: false }
      );
    }

    tx.set(
      userRef,
      {
        purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      invRef,
      {
        status: "PAID",
        paidAt: inv.paidAt ?? admin.firestore.FieldValue.serverTimestamp(),
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

function getInvoiceDocIdFromReq(req: Request) {
  const url = new URL(req.url);
  const invoiceDocId = url.searchParams.get("invoiceDocId");
  return invoiceDocId?.trim() || null;
}

// GET callback
export async function GET(req: Request) {
  try {
    const invoiceDocId = getInvoiceDocIdFromReq(req);
    if (!invoiceDocId) return NextResponse.json({ ok: false, message: "Missing invoiceDocId" }, { status: 400 });

    const db = adminDb();
    const invSnap = await db.collection("qpayInvoices").doc(invoiceDocId).get();
    if (!invSnap.exists) return NextResponse.json({ ok: false, message: "Invoice not found" }, { status: 404 });

    const inv = invSnap.data() as any;
    const qpayInvoiceId = String(inv?.qpayInvoiceId || "");
    if (!qpayInvoiceId) return NextResponse.json({ ok: false, message: "Missing qpayInvoiceId" }, { status: 500 });

    const chk = await qpayCheckPaymentByInvoice(qpayInvoiceId);

    if (chk.paid) await finalize(db, invoiceDocId);

    // QPay талд OK буцаах нь чухал (ихэнхдээ 200)
    return NextResponse.json({ ok: true, paid: chk.paid });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

// POST callback (зарим config дээр POST байж болно)
export async function POST(req: Request) {
  return GET(req);
}