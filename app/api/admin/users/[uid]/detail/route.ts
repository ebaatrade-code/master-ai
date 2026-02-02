// app/api/admin/users/[uid]/detail/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";

function toISO(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return null;
}

export async function GET(req: Request, ctx: { params: { uid: string } }) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const targetUid = ctx.params.uid;

  const userSnap = await adminDb().collection("users").doc(targetUid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const user = userSnap.data() as any;
  const purchasedCourseIds: string[] = Array.isArray(user?.purchasedCourseIds) ? user.purchasedCourseIds : [];

  // recent purchases (incl manual)
  const purchasesSnap = await adminDb()
    .collection("purchases")
    .where("uid", "==", targetUid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const purchases = purchasesSnap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      courseId: x?.courseId || null,
      status: x?.status || null,
      provider: x?.provider || null,
      amount: x?.amount ?? null,
      reason: x?.reason || null,
      createdAt: toISO(x?.createdAt),
    };
  });

  // payment issue (open/resolved) — latest 1
  const issuesSnap = await adminDb()
    .collection("paymentIssues")
    .where("uid", "==", targetUid)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const issues = issuesSnap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      status: x?.status || "open",
      reason: x?.reason || "",
      courseId: x?.courseId || null,
      createdAt: toISO(x?.createdAt),
      resolvedAt: toISO(x?.resolvedAt),
    };
  });

  // optional: map courseId -> title (if you have courses collection)
  // We'll keep minimal: UI can show courseId. If you want title, add another query later.
  return NextResponse.json({
    ok: true,
    user: {
      uid: targetUid,
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      role: user?.role || "",
      avatarUrl: user?.avatarUrl || null,
      lastActiveAt: toISO(user?.lastActiveAt),
      purchasedCourseIds,
    },
    purchases,
    issues,
  });
}
