// FILE: app/api/qpay/deeplink/check/route.ts
import { NextResponse } from "next/server";
import { qpayCheckInvoicePaid } from "@/lib/qpay";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function isSafeId(v: string) {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(v);
}

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) return noStoreJson({ ok: false, error: "UNAUTHENTICATED" }, 401);

    let uid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(idToken, true);
      uid = decoded.uid;
    } catch {
      return noStoreJson({ ok: false, error: "INVALID_TOKEN" }, 401);
    }

    // ── Body ─────────────────────────────────────────────────────────────
    const json = (await req.json().catch(() => null)) as
      | { orderId?: unknown; qpayInvoiceId?: unknown; invoiceId?: unknown }
      | null;

    const orderId = String(json?.orderId ?? "").trim();
    const directInvoiceId = String(json?.qpayInvoiceId ?? json?.invoiceId ?? "").trim();

    // orderId байвал Firestore-оос invoiceId-г татна (ownership шалгана)
    let invoiceId = directInvoiceId;

    if (isSafeId(orderId)) {
      const db = adminDb();
      const paySnap = await db.collection("qpayPayments").doc(orderId).get();
      if (!paySnap.exists) return noStoreJson({ ok: false, error: "Order not found" }, 404);

      const pay = paySnap.data() as any;

      // Энэ payment өөрийнх эсэхийг шалгана
      if (pay.uid !== uid) return noStoreJson({ ok: false, error: "FORBIDDEN" }, 403);

      invoiceId = String(pay.qpayInvoiceId ?? "");
    }

    if (!invoiceId || invoiceId.length < 8) {
      return noStoreJson({ ok: false, error: "Invalid invoiceId" }, 400);
    }

    const { paid, raw } = await qpayCheckInvoicePaid(invoiceId);

    // Төлөгдсөн бол status шинэчилнэ
    if (paid && isSafeId(orderId)) {
      const db = adminDb();
      await db.collection("qpayPayments").doc(orderId).update({
        status: "PAID",
        paid: true,
        checkedAt: new Date(),
      }).catch(() => {});
    }

    return noStoreJson({ ok: true, paid, status: paid ? "PAID" : "PENDING" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ ok: false, error: msg }, 500);
  }
}
