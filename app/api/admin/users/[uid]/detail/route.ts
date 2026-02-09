// app/api/admin/users/[uid]/detail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/**
 * Admin only: user detail + purchases + issues
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

type PurchaseRow = {
  id: string;
  courseId?: string;
  amount?: number;
  status?: string;
  invoice_id?: string;
  createdAt?: any;
};

type IssueRow = {
  id: string;
  type?: string; // "PAYMENT_OPEN" гэх мэт
  message?: string;
  createdAt?: any;
  isOpen?: boolean;
};

function jsonOk(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, error: "UNAUTHENTICATED" as const };

  const decoded = await adminAuth().verifyIdToken(token);
  const callerUid = decoded.uid;

  // caller user doc → role шалгана
  const callerSnap = await adminDb().collection("users").doc(callerUid).get();
  const caller = (callerSnap.exists ? (callerSnap.data() as UserDoc) : null) as UserDoc | null;

  const role = caller?.role || "student";
  if (role !== "admin") {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, callerUid };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    // ✅ Next.js 16: params Promise
    const { uid } = await params;

    // ✅ Admin guard
    const guard = await requireAdmin(request);
    if (!guard.ok) return jsonOk({ ok: false, error: guard.error }, guard.error === "UNAUTHENTICATED" ? 401 : 403);

    // ✅ User doc
    const userRef = adminDb().collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return jsonOk({ ok: false, error: "USER_NOT_FOUND" }, 404);

    const userData = userSnap.data() as UserDoc;

    // ✅ Purchases (сонголт 1): purchases collection дээр userId-р
    // Хэрвээ чиний бүтэц өөр бол энэ query-г өөрийнхөөрөө солино.
    const purchasesSnap = await adminDb()
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
        };
      }) ?? [];

    // ✅ Issues (сонголт 2): payment_issues collection дээр userId-р
    const issuesSnap = await adminDb()
      .collection("payment_issues")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .catch(() => null);

    const issues: IssueRow[] =
      issuesSnap?.docs?.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          type: x.type,
          message: x.message,
          createdAt: x.createdAt ?? null,
          isOpen: typeof x.isOpen === "boolean" ? x.isOpen : (x.status ? x.status !== "CLOSED" : true),
        };
      }) ?? [];

    // ✅ Response shape (Admin UI-д чинь хэрэгтэй формат)
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
      purchases,
      issues,
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
