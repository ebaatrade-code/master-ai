// FILE: app/api/qpay/check/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCheckInvoicePaid } from "@/lib/qpay";
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

function s(x: any) {
  return String(x ?? "").trim();
}

function n(x: any): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function pickThumb(course: any): string | null {
  const t1 = s(course?.thumbnailUrl);
  const t2 = s(course?.thumbUrl);
  const out = t1 || t2;
  return out ? out : null;
}

function pickDurationDays(course: any): number {
  const d1 = n(course?.durationDays);
  if (d1 && d1 > 0) return d1;

  const d2 = n(course?.accessDays);
  if (d2 && d2 > 0) return d2;

  const m = n(course?.accessMonths);
  if (m && m > 0) return Math.round(m * 30);

  return 30;
}

function pickDurationLabel(course: any, durationDays: number): string {
  const lbl = s(course?.durationLabel);
  if (lbl) return lbl;
  return `${durationDays} хоног`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * ✅ finalizePurchaseIfNeeded:
 * - idempotent
 * - PAID болсон байсан ч "cleanup" заавал хийнэ
 * - users/{uid}.purchases[courseId] nested map зөв бичнэ
 * - буруу "purchases.<courseId>" (literal dotted field)-г ALWAYS delete хийнэ
 */
async function finalizePurchaseIfNeeded(db: FirebaseFirestore.Firestore, invoiceDocId: string) {
  const invRef = db.collection("qpayInvoices").doc(invoiceDocId);

  await db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw new Error("Invoice not found");

    const inv = invSnap.data() as any;

    const uid = s(inv.uid);
    const courseId = s(inv.courseId);
    const qpayInvoiceId = s(inv.qpayInvoiceId);
    const amount = Number(inv.amount || 0);

    if (!uid || !courseId) throw new Error("Invoice data incomplete");

    const userRef = db.collection("users").doc(uid);

    // ✅ ALWAYS cleanup dotted field (even if already finalized earlier)
    // This targets the literal top-level field named "purchases.<courseId>"
    tx.set(
      userRef,
      {
        [`purchases.${courseId}`]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Хэрвээ өмнө нь finalized болсон бол — зөвхөн cleanup хийгээд гарах
    if (inv.status === "PAID" && inv.finalizedAt) {
      return;
    }

    if (!qpayInvoiceId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invoice data incomplete");
    }

    const courseRef = db.collection("courses").doc(courseId);
    const purchaseRef = db.collection("purchases").doc(qpayInvoiceId);

    const courseSnap = await tx.get(courseRef);
    if (!courseSnap.exists) throw new Error("COURSE_NOT_FOUND");
    const c = courseSnap.data() || {};

    const courseTitle = s(c?.title) || null;
    const courseThumbUrl = pickThumb(c);
    const durationDays = pickDurationDays(c);
    const durationLabel = pickDurationLabel(c, durationDays);

    const now = new Date();
    const purchasedAt = admin.firestore.Timestamp.fromDate(now);
    const activatedAt = purchasedAt;
    const expiresAt = admin.firestore.Timestamp.fromDate(addDays(now, durationDays));

    // ✅ purchases log (stable id)
    const purchaseSnap = await tx.get(purchaseRef);
    if (!purchaseSnap.exists) {
      tx.set(purchaseRef, {
        uid,
        userId: uid,
        courseId,
        qpayInvoiceId,
        amount,
        purchasedAt,
        activatedAt,
        expiresAt,
        durationDays,
        durationLabel,
        courseTitle,
        courseThumbUrl,
        status: "PAID",
        provider: "qpay",
        source: "qpay",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(
        purchaseRef,
        {
          status: "PAID",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // ✅ user entitlement (nested map зөв)
    tx.set(
      userRef,
      {
        purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        purchases: {
          [courseId]: {
            purchasedAt,
            activatedAt,
            expiresAt,
            durationDays,
            durationLabel,
            courseTitle,
            courseThumbUrl,
            active: true,
            provider: "qpay",
            status: "PAID",
            amount,
            invoiceDocId,
            qpayInvoiceId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
      },
      { merge: true }
    );

    // ✅ invoice finalize
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
    const invoiceDocId = s(body?.invoiceDocId);
    if (!invoiceDocId) return jsonError("invoiceDocId is required", 400);

    const db = adminDb();
    const invRef = db.collection("qpayInvoices").doc(invoiceDocId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) return jsonError("Invoice not found", 404);

    const inv = invSnap.data() as any;
    if (s(inv.uid) !== uid) return jsonError("Forbidden", 403);

    // ✅ IMPORTANT:
    // PAID байсан ч finalize (cleanup) ALWAYS дуудагдана.
    if (inv.status === "PAID") {
      await finalizePurchaseIfNeeded(db, invoiceDocId);
      return NextResponse.json({ ok: true, paid: true, status: "PAID" });
    }

    const qpayInvoiceId = s(inv.qpayInvoiceId);
    if (!qpayInvoiceId) return jsonError("Invoice missing qpayInvoiceId", 500);

    const chk = await qpayCheckInvoicePaid(qpayInvoiceId);

    if (chk.paid) {
      await finalizePurchaseIfNeeded(db, invoiceDocId);
      return NextResponse.json({ ok: true, paid: true, status: "PAID" });
    }

    return NextResponse.json({ ok: true, paid: false, status: "PENDING" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    const status = msg.toLowerCase().includes("id token") ? 401 : 500;
    return NextResponse.json({ ok: false, message: msg }, { status });
  }
}