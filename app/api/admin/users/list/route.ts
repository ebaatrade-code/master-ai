// app/api/admin/users/list/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";

type Row = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  avatarUrl?: string | null;

  purchasedCount: number;

  lastActiveAt?: string | null; // ISO
  hasPaymentIssueOpen: boolean;
};

function toISOAny(v: any): string | null {
  // Firestore Timestamp | ISO string | null -> ISO string
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  // Already ISO string
  if (typeof v === "string") {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }

  return null;
}

function isoToMs(iso?: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const filter = (searchParams.get("filter") || "all").trim(); // all | vip | zero | payment | active7
  const limit = Math.min(Number(searchParams.get("limit") || "120"), 300);

  // 1) users татах — orderBy хэрэглэхгүй (createdAt Timestamp биш байж магадгүй)
  const usersSnap = await adminDb().collection("users").limit(limit).get();

  // 2) open payment issues → uid set
  const issuesSnap = await adminDb()
    .collection("paymentIssues")
    .where("status", "==", "open")
    .limit(500)
    .get();

  const openIssueUids = new Set<string>();
  issuesSnap.forEach((d) => {
    const data = d.data() as any;
    if (data?.uid) openIssueUids.add(String(data.uid));
  });

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 3) rows build
  let rows: Row[] = [];
  usersSnap.forEach((doc) => {
    const data = doc.data() as any;

    const name = String(data?.name || "Unnamed");
    const email = String(data?.email || "");
    const phone = data?.phone ? String(data.phone) : "";
    const role = data?.role ? String(data.role) : "";

    const purchasedIds = Array.isArray(data?.purchasedCourseIds) ? (data.purchasedCourseIds as string[]) : [];
    const purchasedCount = purchasedIds.length;

    const lastActiveISO = toISOAny(data?.lastActiveAt);
    const lastActiveMs = isoToMs(lastActiveISO);
    const isActive7 = lastActiveMs ? now - lastActiveMs <= sevenDaysMs : false;

    const hasIssue = openIssueUids.has(doc.id);

    // search
    const hay = `${name} ${email} ${phone}`.toLowerCase();
    const passSearch = q ? hay.includes(q) : true;

    // filters
    let passFilter = true;
    if (filter === "vip") passFilter = role.toLowerCase() === "vip";
    else if (filter === "zero") passFilter = purchasedCount === 0;
    else if (filter === "payment") passFilter = hasIssue;
    else if (filter === "active7") passFilter = isActive7;

    if (!passSearch || !passFilter) return;

    rows.push({
      uid: doc.id,
      name,
      email,
      phone,
      role,
      avatarUrl: data?.avatarUrl || null,
      purchasedCount,
      lastActiveAt: lastActiveISO,
      hasPaymentIssueOpen: hasIssue,
    });
  });

  // 4) Server-side sort (createdAt string/timestamp аль аль нь байж болно)
  // createdAt байхгүй бол 0 гэж үзнэ
  rows = rows.sort((a, b) => {
    // we try to read from doc? we don't have here. So keep stable sort by name/email as fallback.
    return a.name.localeCompare(b.name);
  });

  // 5) stats
  const totalUsers = usersSnap.size;
  const active7 = rows.filter((r) => {
    const ms = isoToMs(r.lastActiveAt);
    return ms ? now - ms <= sevenDaysMs : false;
  }).length;

  const paymentOpen = openIssueUids.size;

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers,
      active7,
      paymentOpen,
      revenue30d: null,
    },
    rows,
  });
}
