// app/api/admin/users/[uid]/notify/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  title: string;
  body: string;
  link?: string;
  type?: string; // "info" | "warning" | "grant" | etc
};

export async function POST(req: Request, ctx: { params: { uid: string } }) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const targetUid = ctx.params.uid;
  const body = (await req.json()) as Body;

  const title = String(body?.title || "").trim();
  const msg = String(body?.body || "").trim();
  const link = body?.link ? String(body.link) : "/my-content";
  const type = body?.type ? String(body.type) : "info";

  if (!title || !msg) return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });

  const notifRef = adminDb().collection("notifications").doc(targetUid).collection("items").doc();
  await notifRef.set({
    title,
    body: msg,
    type,
    link,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
  });

  return NextResponse.json({ ok: true });
}
