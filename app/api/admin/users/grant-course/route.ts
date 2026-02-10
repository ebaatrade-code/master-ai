import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  uid: string;
  courseId: string;
  reason: "promo" | "payment_fix" | "support";
};

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const body = (await req.json()) as Body;
  const uid = String(body?.uid || "");
  const courseId = String(body?.courseId || "");
  const reason = body?.reason;

  if (!uid || !courseId || !reason) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  // 1) users/{uid}.purchasedCourseIds += courseId
  await adminDb().collection("users").doc(uid).set(
    { purchasedCourseIds: FieldValue.arrayUnion(courseId) },
    { merge: true }
  );

  // 2) purchases record
  await adminDb().collection("purchases").add({
    uid,
    courseId,
    status: "manual",
    provider: "manual",
    amount: 0,
    reason,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 3) notification
  await adminDb().collection("notifications").doc(uid).collection("items").add({
    title: "Шинэ сургалт нэмэгдлээ",
    body: "Админаас танд сургалт нэмэгдлээ.",
    type: "grant",
    link: `/course/${courseId}`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
