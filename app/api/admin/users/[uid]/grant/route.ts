// app/api/admin/users/[uid]/grant/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  courseId: string;
  reason: "promo" | "payment_fix" | "support";
  link?: string; // optional override
};

export async function POST(req: Request, ctx: { params: { uid: string } }) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const targetUid = ctx.params.uid;
  const body = (await req.json()) as Body;

  const courseId = String(body?.courseId || "").trim();
  const reason = body?.reason;

  if (!courseId) return NextResponse.json({ ok: false, error: "MISSING_COURSE_ID" }, { status: 400 });
  if (!reason || !["promo", "payment_fix", "support"].includes(reason)) {
    return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const userRef = adminDb().collection("users").doc(targetUid);
  const purchaseRef = adminDb().collection("purchases").doc(); // auto id
  const notifRef = adminDb().collection("notifications").doc(targetUid).collection("items").doc();

  const link = body?.link || `/course/${courseId}`;

  await adminDb().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

    tx.update(userRef, {
      purchasedCourseIds: FieldValue.arrayUnion(courseId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(purchaseRef, {
      uid: targetUid,
      courseId,
      status: "manual",
      provider: "manual",
      amount: 0,
      reason,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(notifRef, {
      title: "Сургалт идэвхжлээ ✅",
      body:
        reason === "promo"
          ? "Танд бэлэг болгон сургалт идэвхжүүллээ."
          : reason === "payment_fix"
          ? "Төлбөрийн асуудлыг шийдвэрлэж, сургалтыг идэвхжүүллээ."
          : "Тусламжийн хүрээнд сургалтыг идэвхжүүллээ.",
      type: "grant",
      link,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });
  });

  return NextResponse.json({ ok: true });
}
