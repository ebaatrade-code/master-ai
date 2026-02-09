// app/api/admin/users/[uid]/payment-issue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  status: "open" | "resolved";
  reason?: string;
  courseId?: string | null;
};

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

  const { uid: targetUid } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;

  const status = body?.status;
  if (!status || !["open", "resolved"].includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const courseId = body?.courseId ? String(body.courseId) : null;
  const reason = body?.reason ? String(body.reason) : "";

  // stable doc id => easy to show dot quickly
  const docId = `${targetUid}_${courseId || "general"}`;
  const ref = adminDb().collection("paymentIssues").doc(docId);

  const payload: any = {
    uid: targetUid,
    courseId: courseId || null,
    reason,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (status === "open") {
    // createdAt-ыг анх үүсгэх үед л тогтоох (overwrite хийхээс хамгаална)
    payload.createdAt = FieldValue.serverTimestamp();
    payload.resolvedAt = null;
  } else {
    payload.resolvedAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });

  return NextResponse.json({ ok: true });
}