// app/api/admin/users/[uid]/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  courseId: string;
  reason: "promo" | "payment_fix" | "support";
  link?: string;
};

// ✅ IMPORTANT: Next.js чинь context.params-ыг Promise гэж шаардаж байна
type Ctx = { params: Promise<{ uid: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    // ✅ Admin gate
    const gate = await requireAdminFromRequest(req);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: gate.error },
        { status: gate.status }
      );
    }

    // ✅ params is Promise -> await
    const { uid } = await params;
    const targetUid = String(uid || "").trim();
    if (!targetUid) {
      return NextResponse.json({ ok: false, error: "MISSING_UID" }, { status: 400 });
    }

    const raw = await req.json().catch(() => ({}));
    const body = raw as Partial<Body>;

    const courseId = String(body?.courseId || "").trim();
    const reason = body?.reason;

    if (!courseId) {
      return NextResponse.json({ ok: false, error: "MISSING_COURSE_ID" }, { status: 400 });
    }
    if (!reason || !["promo", "payment_fix", "support"].includes(reason)) {
      return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
    }

    const db = adminDb();

    const userRef = db.collection("users").doc(targetUid);
    const purchaseRef = db.collection("purchases").doc(); // auto id
    const notifRef = db.collection("notifications").doc(targetUid).collection("items").doc();

    const link = String(body?.link || "").trim() || `/course/${courseId}`;

    await db.runTransaction(async (tx) => {
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
  } catch (e: any) {
    const msg = String(e?.message || "UNKNOWN");
    const status = msg === "USER_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}