import { NextRequest, NextResponse } from "next/server";
import { adminApp, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSafeId(v: string) {
  return typeof v === "string" && v.length >= 1 && v.length <= 200 && /^[A-Za-z0-9_-]+$/.test(v);
}

// Public endpoint — returns lesson metadata (no video URLs) for any published course.
// Used by the course preview page so non-logged-in users can still see the lesson list.
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId") ?? "";
    if (!isSafeId(courseId)) {
      return NextResponse.json({ ok: false, message: "Invalid courseId" }, { status: 400 });
    }

    adminApp();
    const db = adminDb();

    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      return NextResponse.json({ ok: false, message: "Course not found" }, { status: 404 });
    }

    const course = courseSnap.data() as any;
    if (course?.isPublished !== true) {
      return NextResponse.json({ ok: false, message: "Course not available" }, { status: 403 });
    }

    const lessonsSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("lessons")
      .orderBy("order", "asc")
      .get();

    const lessons = lessonsSnap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: String(data.title ?? ""),
          order: typeof data.order === "number" ? data.order : 0,
          durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
          description: String(data.description ?? ""),
          isPublished: data.isPublished !== false,
          isFreePreview: data.isFreePreview === true,
          // Only the storage path — no signed URLs here
          videoPath: String(data.videoPath || data.video?.storagePath || ""),
          video: data.video
            ? { storagePath: String(data.video.storagePath || "") }
            : undefined,
        };
      })
      .filter((l) => l.isPublished);

    return NextResponse.json({ ok: true, lessons }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (e) {
    console.error("[course/lessons] error:", e);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
