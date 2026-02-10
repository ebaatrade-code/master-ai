import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { qpayCheckPaymentByInvoice } from "@/lib/qpay";

type QPayRow = {
  payment_status?: string; // "PAID" гэх мэт
  payment_status_date?: string;
  [k: string]: any;
};

type QPayPaymentCheckResponse = {
  count?: number;
  rows?: QPayRow[];
  [k: string]: any;
};

function isPaidFromQpayCheck(raw: QPayPaymentCheckResponse | null | undefined) {
  const rows = Array.isArray(raw?.rows) ? raw!.rows : [];
  // QPay заримдаа payment_status = "PAID" / "paid" / "SUCCESS" гэх мэт ирж болно
  return rows.some((r) => {
    const s = String(r?.payment_status || "").toLowerCase();
    return s === "paid" || s === "success" || s === "paid_success";
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { ref?: string } | null;
    const refId = String(body?.ref ?? "").trim();
    if (!refId) return NextResponse.json({ ok: false, error: "Missing ref" }, { status: 400 });

    const db = adminDb();
    const ref = db.collection("qpay_invoices").doc(refId); // ✅ таны одоогийн зөв collection
    const snap = await ref.get();

    if (!snap.exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const pay = snap.data() as any;

    // өмнө paid бол шууд true
    if (pay?.paid === true || pay?.status === "paid") {
      return NextResponse.json({ ok: true, paid: true });
    }

    const qpayInvoiceId = String(pay?.qpayInvoiceId || pay?.invoiceId || "").trim();
    if (!qpayInvoiceId) {
      return NextResponse.json({ ok: false, error: "Missing qpayInvoiceId" }, { status: 400 });
    }

    const raw = (await qpayCheckPaymentByInvoice(qpayInvoiceId)) as QPayPaymentCheckResponse;
    const paid = isPaidFromQpayCheck(raw);

    if (!paid) {
      return NextResponse.json({ ok: true, paid: false, raw });
    }

    // ✅ PAID болсон бол Firestore дээрээ update
    await ref.set(
      {
        paid: true,
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, paid: true, raw });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: typeof e?.message === "string" ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}