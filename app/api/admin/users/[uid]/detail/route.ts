// app/api/admin/users/[uid]/detail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";

/**
 * Admin only: user detail + purchases + issues + ✅ courses list
 * Next.js 16 route typing requirement:
 *  - request: NextRequest
 *  - params: Promise<{ uid: string }>
 */

type UserDoc = {
  email?: string;
  name?: string;
  phone?: string;
  role?: string; // "admin" | "analyst" | "student" ...
  avatarUrl?: string | null;
  lastActiveAt?: string | null;
  purchasedCourseIds?: string[];
};

type CourseMini = {
  id: string;
  title?: string | null;
};

type PurchaseRow = {
  id: string;
  courseId?: string;
  amount?: number;
  status?: string;
  invoice_id?: string;
  createdAt?: any;

  // ✅ backward-compatible extra
  provider?: string;
  reason?: string;
};

type IssueRow = {
  id: string;

  // existing
  type?: string; // "PAYMENT_OPEN" гэх мэт
  message?: string;
  createdAt?: any;
  isOpen?: boolean;

  // ✅ extra fields (new UI-д хэрэг болж магадгүй)
  status?: string;
  reason?: string;
  courseId?: string | null;
  resolvedAt?: any;
};

function jsonOk(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function toISOStringMaybe(x: any) {
  try {
    if (!x) return null;
    if (typeof x === "string") return x;
    if (x?.toDate?.()) return x.toDate().toISOString();
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    // ✅ Admin guard (your shared helper)
    const gate = await requireAdminFromRequest(request);
    if (!gate.ok) {
      return jsonOk(
        { ok: false, error: gate.error },
        gate.status
      );
    }

    const db = adminDb();

    // ✅ User doc
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return jsonOk({ ok: false, error: "USER_NOT_FOUND" }, 404);

    const userData = userSnap.data() as UserDoc;

    // ✅ Courses list (for "auto fill dropdown")
    // NOTE: collection name = "courses" гэж үзэв.
    const coursesSnap = await db.collection("courses").get().catch(() => null);
    const courses: CourseMini[] =
      coursesSnap?.docs?.map((d) => {
        const x = d.data() as any;
        return { id: d.id, title: x?.title ?? null };
      }) ?? [];

    // ✅ Purchases
    const purchasesSnap = await db
      .collection("purchases")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .catch(() => null);

    const purchases: PurchaseRow[] =
      purchasesSnap?.docs?.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          courseId: x.courseId,
          amount: typeof x.amount === "number" ? x.amount : Number(x.amount || 0),
          status: x.status,
          invoice_id: x.invoice_id,
          createdAt: x.createdAt ?? null,

          // ✅ optional fields (manual grant route чинь эднийг бичдэг)
          provider: x.provider,
          reason: x.reason,
        };
      }) ?? [];

    // ✅ Issues
    const issuesSnap = await db
      .collection("payment_issues")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .catch(() => null);

    const issues: IssueRow[] =
      issuesSnap?.docs?.map((d) => {
        const x = d.data() as any;

        // your old logic
        const isOpen =
          typeof x.isOpen === "boolean"
            ? x.isOpen
            : x.status
            ? x.status !== "CLOSED"
            : true;

        return {
          id: d.id,

          type: x.type,
          message: x.message,
          createdAt: x.createdAt ?? null,
          isOpen,

          // ✅ extra fields (if you start using them later)
          status: x.status ?? (isOpen ? "OPEN" : "CLOSED"),
          reason: x.reason ?? x.message ?? "",
          courseId: x.courseId ?? null,
          resolvedAt: x.resolvedAt ?? null,
        };
      }) ?? [];

    return jsonOk({
      ok: true,
      user: {
        uid,
        name: userData?.name ?? "",
        email: userData?.email ?? "",
        phone: userData?.phone ?? "",
        role: userData?.role ?? "student",
        avatarUrl: userData?.avatarUrl ?? null,
        lastActiveAt: userData?.lastActiveAt ?? null,
        purchasedCourseIds: Array.isArray(userData?.purchasedCourseIds) ? userData.purchasedCourseIds : [],
      },

      // ✅ NEW
      courses,

      purchases,
      issues,

      // ✅ optional helper timestamps (safe)
      meta: {
        fetchedAt: new Date().toISOString(),
        userLastActiveISO: toISOStringMaybe(userData?.lastActiveAt),
      },
    });
  } catch (e: any) {
    return jsonOk(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: e?.message || "Unknown error",
      },
      500
    );
  }
}