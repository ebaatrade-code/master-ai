import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";

type CourseLite = { id: string; title: string };

export async function GET(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const snap = await adminDb().collection("courses").limit(500).get();

  const courses: CourseLite[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    const title = String(data?.title || data?.name || d.id);
    courses.push({ id: d.id, title });
  });

  // server-side sort (field байхгүйгээс orderBy хэрэглэхгүй)
  courses.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ ok: true, courses });
}
