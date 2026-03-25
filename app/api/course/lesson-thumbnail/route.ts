import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminApp, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBucketName(): string {
  const raw =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "";
  return String(raw).trim().replace(/^gs:\/\//i, "").replace(/\/+$/, "");
}

function isSafeStoragePath(v: string): boolean {
  if (!v || v.length > 1000) return false;
  if (v.includes("..") || v.includes("\\")) return false;
  if (/^gs:\/\//i.test(v) || /^https?:\/\//i.test(v)) return false;
  if (v.startsWith("/")) return false;
  if (!/^[A-Za-z0-9/_\-.]+$/.test(v)) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const courseId = String(body?.courseId || "").trim();
    const lessonId = String(body?.lessonId || "").trim();

    if (!courseId || !lessonId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    adminApp(); // ensure admin initialized
    const db = adminDb();

    const lessonSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("lessons")
      .doc(lessonId)
      .get();

    if (!lessonSnap.exists) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const lesson = lessonSnap.data() as any;
    const storagePath = String(
      lesson?.video?.storagePath || lesson?.videoPath || lesson?.storagePath || ""
    ).trim();

    if (!storagePath || !isSafeStoragePath(storagePath)) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      return NextResponse.json({ ok: false, message: "Storage bucket not configured" }, { status: 500 });
    }

    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(storagePath);

    // Short-lived signed URL for thumbnail — 30 minutes
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 30 * 60 * 1000,
    });

    return NextResponse.json(
      { ok: true, url },
      { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } }
    );
  } catch (e) {
    console.error("[lesson-thumbnail] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
