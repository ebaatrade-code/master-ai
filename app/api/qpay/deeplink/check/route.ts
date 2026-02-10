// app/api/qpay/deeplink/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCheckPaymentByInvoice } from "@/lib/qpay";

export const dynamic = "force-dynamic";

type QPayRow = { payment_status?: string; [k: string]: any };
type QPayPaymentCheckResponse = { count?: number; rows?: QPayRow[]; [k: string]: any };

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

function isPaidFromQpay(raw: QPayPaymentCheckResponse | null | undefined) {
  const rows = Array.isArray(raw?.rows) ? raw!.rows : [];
  return rows.some((r) => String(r?.payment_status || "").toLowerCase() === "paid");
}

export async function POST(req: NextRequest) {
  try {
    // ✅ (optional) user auth - client-аас idToken явуулж байвал хамгаална
    const idToken = getBearerToken(req);
    if (!idToken) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization Bearer token" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // ✅ body
    const body = (await req.json().catch(() => null)) as { ref?: string } | null;
    const refId = String(body?.ref ?? "").trim();
    if (!refId) return NextResponse.json({ ok: false, error: "Missing ref" }, { status: 400 });

    const db = adminDb();
    const ref = db.collection("qpayPayments").doc(refId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const pay = snap.data() as any;

    // ✅ зөвхөн өөрийнхөө order-г шалгана (admin биш бол)
    if (String(pay?.uid || "") !== uid) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // ✅ already paid
    if (pay?.paid === true || pay?.status === "paid") {
      return NextResponse.json({ ok: true, paid: true });
    }

    const invoiceId = String(pay?.invoiceId || "").trim();
    if (!invoiceId) {
      return NextResponse.json({ ok: false, error: "Missing invoiceId in qpayPayments doc" }, { status: 400 });
    }

    // ✅ QPay check
    const raw = (await qpayCheckPaymentByInvoice(invoiceId)) as QPayPaymentCheckResponse;
    const paid = isPaidFromQpay(raw);

    if (!paid) {
      return NextResponse.json({ ok: true, paid: false, raw });
    }

    // ✅ paid => Firestore update + purchase unlock
    const courseId = String(pay?.courseId || "").trim();

    const batch = db.batch();

    // mark order paid
    batch.set(
      ref,
      {
        paid: true,
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ unlock course for user (users/{uid}.purchasedCourseIds)
    if (courseId) {
      const userRef = db.collection("users").doc(uid);
      batch.set(
        userRef,
        {
          purchasedCourseIds: admin.firestore.FieldValue.arrayUnion(courseId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // (optional) purchases collection history
      const purchaseRef = db.collection("purchases").doc(`${uid}_${courseId}`);
      batch.set(
        purchaseRef,
        {
          uid,
          courseId,
          method: "qpay",
          invoiceId,
          orderId: refId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({ ok: true, paid: true, raw });
  } catch (e: any) {
    console.error("QPAY deeplink/check error:", e);
    return NextResponse.json(
      { ok: false, error: typeof e?.message === "string" ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}