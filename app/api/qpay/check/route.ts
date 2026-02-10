// FILE: app/api/qpay/check/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCheckPaymentByInvoice } from "@/lib/qpay";
import * as admin from "firebase-admin";

export const dynamic = "force-dynamic";

type ReqBody = {
  invoiceDocId: string;
};

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * ✅ finalizePurchase:
 * - idempotent
 * - purchases/{qpayInvoiceId} (stable id) үүсгэнэ
 * - users/{uid}.purchasedCourseIds arrayUnion(courseId)
 * - invoice.status = PAID + timestamps
 */
async function finalizePurchaseIfNeeded(db: FirebaseFirestore.Firestore, invoiceDocId: string) {
  const invRef = db.collection("qpayInvoices").doc(invoiceDocId);

  await db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw new Error("Invoice not found");

    const inv = invSnap.data() as any;

    if (inv.status === "PAID" && inv.finalizedAt) {
      // already finalized
      return;
    }

    const uid = String(inv.uid || "");
    const courseId = String(inv.courseId || "");
    const qpayInvoiceId = String(inv.qpayInvoiceId || "");
    const amount = Number(inv.amount || 0);

    if (!uid || !courseId || !qpayInvoiceId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invoice data incomplete");
    }

    const purchaseRef = db.collection("purchases").doc(qpayInvoiceId);
    const userRef = db.collection("users").doc(uid);

    // purchase doc exists бол idempotent
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

    // user purchasedCourseIds update
    tx.set(
      userRef,
      {
        purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // invoice update
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

export async function POST(req: Request) {
  try {
    const idToken = getBearer(req);
    if (!idToken) return jsonError("Missing Authorization: Bearer <firebase_id_token>", 401);

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = (await req.json()) as ReqBody;
    const invoiceDocId = (body?.invoiceDocId || "").trim();
    if (!invoiceDocId) return jsonError("invoiceDocId is required", 400);

    const db = adminDb();
    const invRef = db.collection("qpayInvoices").doc(invoiceDocId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) return jsonError("Invoice not found", 404);

    const inv = invSnap.data() as any;
    if (String(inv.uid) !== uid) return jsonError("Forbidden", 403);

    // already paid shortcut
    if (inv.status === "PAID") {
      return NextResponse.json({ ok: true, paid: true, status: "PAID" });
    }

    const qpayInvoiceId = String(inv.qpayInvoiceId || "");
    if (!qpayInvoiceId) return jsonError("Invoice missing qpayInvoiceId", 500);

    const chk = await qpayCheckPaymentByInvoice(qpayInvoiceId);

    if (chk.paid) {
      await finalizePurchaseIfNeeded(db, invoiceDocId);
      return NextResponse.json({ ok: true, paid: true, status: "PAID" });
    }

    // unpaid
    return NextResponse.json({ ok: true, paid: false, status: "PENDING" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    const status = msg.toLowerCase().includes("id token") ? 401 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}