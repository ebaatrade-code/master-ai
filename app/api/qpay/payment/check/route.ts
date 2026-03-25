// FILE: app/api/qpay/payment/check/route.ts
import { NextResponse } from "next/server";
import { qpayCheckInvoicePaid } from "@/lib/qpay";
import { adminAuth } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) return noStoreJson({ ok: false, error: "UNAUTHENTICATED" }, 401);

    try {
      await adminAuth().verifyIdToken(idToken, true);
    } catch {
      return noStoreJson({ ok: false, error: "INVALID_TOKEN" }, 401);
    }

    // ── Body ─────────────────────────────────────────────────────────────
    const json = (await req.json().catch(() => null)) as { qpayInvoiceId?: unknown; invoiceId?: unknown } | null;
    const invoiceId = String(json?.qpayInvoiceId ?? json?.invoiceId ?? "").trim();
    if (!invoiceId || invoiceId.length < 8) return noStoreJson({ ok: false, error: "Invalid invoiceId" }, 400);

    const { paid, raw } = await qpayCheckInvoicePaid(invoiceId);
    return noStoreJson({ ok: true, paid, raw });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ ok: false, error: msg }, 500);
  }
}
