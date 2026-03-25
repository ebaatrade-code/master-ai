// app/api/admin/users/[uid]/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  title: string;
  body: string;
  link?: string;
  type?: string; // "info" | "warning" | "grant" | etc
};

// ✅ Next.js (таны Next 15/16) дээр params нь Promise байдаг тул ингэж бичнэ
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> }
) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status }
    );
  }

  // ✅ params-г await заавал
  const { uid: targetUid } = await ctx.params;

  const raw = await req.json().catch(() => ({}));
  const body = raw as Partial<Body>;

  const title = String(body?.title || "").trim().slice(0, 200);
  const msg = String(body?.body || "").trim().slice(0, 1000);
  const link = String(body?.link || "").trim().slice(0, 500) || "/my-content";
  const type = String(body?.type || "").trim().slice(0, 50) || "info";

  if (!title || !msg) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  const db = adminDb();
  const notifRef = db
    .collection("users")
    .doc(targetUid)
    .collection("notifications")
    .doc();

  await notifRef.set({
    title,
    body: msg,
    type,
    link,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
  });

  return NextResponse.json({ ok: true });
}