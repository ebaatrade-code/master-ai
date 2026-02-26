// app/api/admin/users/[uid]/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

type Body = {
  courseId: string;
  reason: "promo" | "payment_fix" | "support";
  link?: string;
};

type Ctx = { params: Promise<{ uid: string }> };

function s(x: any) {
  return String(x ?? "").trim();
}

function n(x: any): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function pickThumb(course: any): string | null {
  const t1 = s(course?.thumbnailUrl);
  const t2 = s(course?.thumbUrl);
  const out = t1 || t2;
  return out ? out : null;
}

function pickDurationDays(course: any): number {
  const d1 = n(course?.durationDays);
  if (d1 && d1 > 0) return d1;

  const d2 = n(course?.accessDays);
  if (d2 && d2 > 0) return d2;

  const m = n(course?.accessMonths);
  if (m && m > 0) return Math.round(m * 30);

  return 30;
}

function pickDurationLabel(course: any, durationDays: number): string {
  const lbl = s(course?.durationLabel);
  if (lbl) return lbl;
  return `${durationDays} хоног`;
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
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
    const reason = body?.reason;

    if (!courseId) return NextResponse.json({ ok: false, error: "MISSING_COURSE_ID" }, { status: 400 });
    if (!reason || !["promo", "payment_fix", "support"].includes(reason)) {
      return NextResponse.json({ ok: false, error: "INVALID_REASON" }, { status: 400 });
    }

    const db = adminDb();

    const userRef = db.collection("users").doc(targetUid);
    const courseRef = db.collection("courses").doc(courseId);

    const purchaseRef = db.collection("purchases").doc(); // audit log
    const notifRef = db.collection("notifications").doc(targetUid).collection("items").doc();

    const link = s(body?.link) || `/course/${courseId}`;

    const now = new Date();
    const purchasedAt = Timestamp.fromDate(now);

    await db.runTransaction(async (tx) => {
      const [userSnap, courseSnap] = await Promise.all([tx.get(userRef), tx.get(courseRef)]);
      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      if (!courseSnap.exists) throw new Error("COURSE_NOT_FOUND");

      const c = courseSnap.data() || {};
      const courseTitle = s(c?.title) || null;
      const courseThumbUrl = pickThumb(c);
      const durationDays = pickDurationDays(c);
      const durationLabel = pickDurationLabel(c, durationDays);
      const expiresAt = Timestamp.fromDate(addDays(now, durationDays));

      // ✅ Nested map зөв бичих
      tx.set(
        userRef,
        {
          purchasedCourseIds: FieldValue.arrayUnion(courseId),
          updatedAt: FieldValue.serverTimestamp(),

          purchases: {
            [courseId]: {
              purchasedAt,
              activatedAt: purchasedAt,
              expiresAt,
              durationDays,
              durationLabel,
              courseTitle,
              courseThumbUrl,
              active: true,
              provider: "manual",
              status: "manual",
              reason,
              grantedAt: purchasedAt,
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

    // ✅ PENDING invoice-ууд архивлах (хуучин логик хэвээр)
    try {
      const invSnap = await db
        .collection("invoices")
        .where("uid", "==", targetUid)
        .where("courseId", "==", courseId)
        .where("status", "==", "PENDING")
        .get();

      if (!invSnap.empty) {
        const batch = db.batch();
        invSnap.docs.forEach((d) => {
          batch.set(
            d.ref,
            {
              status: "ARCHIVED",
              archivedAt: FieldValue.serverTimestamp(),
              archivedReason: "manual_grant",
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || "UNKNOWN");
    const status = msg === "USER_NOT_FOUND" ? 404 : msg === "COURSE_NOT_FOUND" ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}