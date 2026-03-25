// FILE: app/api/qpay/deeplink/create/route.ts
import { NextResponse } from "next/server";
import { qpayCreateInvoice, extractShortUrl, toDataUrlPng, type QPayInvoiceCreateReq } from "@/lib/qpay";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isSafeCourseId(v: string) {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(v);
}

export async function POST(req: Request) {
  try {
    // ── Auth: Bearer token шаардана ──────────────────────────────────────
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

    // ── Body parse ───────────────────────────────────────────────────────
    const json = (await req.json().catch(() => null)) as
      | { courseId?: unknown; description?: unknown; orderId?: unknown; senderInvoiceNo?: unknown }
      | null;

    if (!json) return noStoreJson({ ok: false, error: "Invalid JSON" }, 400);

    const courseId = String(json.courseId ?? "").trim();
    if (!isSafeCourseId(courseId)) return noStoreJson({ ok: false, error: "Invalid courseId" }, 400);

    // ── Firestore-оос үнийг татна (client amount-г ХЭЗЭЭ Ч итгэхгүй) ────
    const db = adminDb();
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) return noStoreJson({ ok: false, error: "Course not found" }, 404);

    const courseData = courseSnap.data() as any;
    if (courseData?.isPublished !== true) return noStoreJson({ ok: false, error: "Course not available" }, 403);

    const amount = Number(courseData?.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return noStoreJson({ ok: false, error: "Course price not set", message: "Курсын үнэ тохируулаагүй байна." }, 400);
    }

    // ── Env ─────────────────────────────────────────────────────────────
    const siteUrl = mustEnv("SITE_URL");
    const invoiceCode = mustEnv("QPAY_INVOICE_CODE");
    const receiverCode = mustEnv("QPAY_INVOICE_RECEIVER_CODE");
    const branchCode = process.env.QPAY_BRANCH_CODE || "ONLINE";

    const description = String(json.description ?? courseData?.title ?? "Master AI payment")
      .replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 140) || "Master AI payment";

    const senderInvoiceNoRaw = String(json.senderInvoiceNo ?? json.orderId ?? `${uid}-${courseId}-${Date.now()}`);
    const sender_invoice_no = senderInvoiceNoRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || String(Date.now());
    const orderId = String(json.orderId ?? sender_invoice_no).slice(0, 80);

    // Callback URL — зөвхөн ref + s (QPay max 255 chars)
    const cbSecret = (process.env.QPAY_CALLBACK_SECRET || "").trim();
    const callback_url =
      `${siteUrl.replace(/\/$/, "")}/api/qpay/callback` +
      `?ref=${encodeURIComponent(orderId)}` +
      (cbSecret ? `&s=${encodeURIComponent(cbSecret)}` : "");

    const payload: QPayInvoiceCreateReq = {
      invoice_code: invoiceCode,
      sender_invoice_no,
      invoice_receiver_code: receiverCode,
      sender_branch_code: branchCode,
      invoice_description: description,
      amount,                    // ← Firestore-оос татсан үнэ
      callback_url,
      allow_partial: false,
      allow_exceed: false,
      enable_expiry: "false",
      minimum_amount: null,
      maximum_amount: null,
    };

    const inv = await qpayCreateInvoice(payload);

    // qpayPayments-д бичнэ (callback verify хийх зорилгоор)
    await db.collection("qpayPayments").doc(orderId).set({
      uid,
      courseId,
      amount,
      courseTitle: String(courseData?.title ?? "").slice(0, 500),
      status: "PENDING",
      qpayInvoiceId: String(inv.invoice_id ?? ""),
      orderId,
      createdAt: new Date(),
      paid: false,
    });

    return noStoreJson({
      ok: true,
      qpayInvoiceId: inv.invoice_id,
      qrText: inv.qr_text ?? null,
      qrImageDataUrl: toDataUrlPng(inv.qr_image ?? null),
      urls: Array.isArray(inv.urls) ? inv.urls : [],
      shortUrl: extractShortUrl(inv.urls),
      orderId,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStoreJson({ ok: false, error: msg }, 500);
  }
}
