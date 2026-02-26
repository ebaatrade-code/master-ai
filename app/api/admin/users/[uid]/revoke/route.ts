// app/api/admin/users/[uid]/revoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  courseId: string;
  link?: string;
};

type Ctx = { params: Promise<{ uid: string }> };

function s(x: any) {
  return String(x ?? "").trim();
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const gate = await requireAdminFromRequest(req);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    const { uid } = await params;
    const targetUid = s(uid);
    if (!targetUid) return NextResponse.json({ ok: false, error: "MISSING_UID" }, { status: 400 });

    const raw = await req.json().catch(() => ({}));
    const body = raw as Partial<Body>;

    const courseId = s(body?.courseId);
    if (!courseId) return NextResponse.json({ ok: false, error: "MISSING_COURSE_ID" }, { status: 400 });

    const db = adminDb();

    const userRef = db.collection("users").doc(targetUid);
    const courseRef = db.collection("courses").doc(courseId);

    const purchaseRef = db.collection("purchases").doc();
    const notifRef = db.collection("notifications").doc(targetUid).collection("items").doc();

    const link = s(body?.link) || `/course/${courseId}`;

    const now = Timestamp.fromDate(new Date());

    await db.runTransaction(async (tx) => {
      const [userSnap, courseSnap] = await Promise.all([tx.get(userRef), tx.get(courseRef)]);
      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      if (!courseSnap.exists) throw new Error("COURSE_NOT_FOUND");

      tx.set(
        userRef,
        {
          purchasedCourseIds: FieldValue.arrayRemove(courseId),
          updatedAt: FieldValue.serverTimestamp(),

          purchases: {
            [courseId]: {
              active: false,
              status: "REVOKED",
              provider: "manual",
              revokedAt: now,
              expiresAt: now,
              revokedReason: "admin_revoke",
              updatedAt: FieldValue.serverTimestamp(),
            },
          },

          // ✅ cleanup: өмнөх буруу dotted field
          [`purchases.${courseId}`]: FieldValue.delete(),
        },
        { merge: true }
      );

      tx.set(purchaseRef, {
        uid: targetUid,
        userId: targetUid,
        courseId,
        status: "revoked_manual",
        provider: "manual",
        amount: 0,
        reason: "revoke",
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(notifRef, {
        title: "Сургалт цуцлагдлаа ⚠️",
        body: "Админ таны сургалтын эрхийг цуцаллаа.",
        type: "revoke",
        link,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || "UNKNOWN");
    const status = msg === "USER_NOT_FOUND" ? 404 : msg === "COURSE_NOT_FOUND" ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}