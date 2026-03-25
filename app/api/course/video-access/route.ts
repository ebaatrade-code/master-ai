import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  courseId: string;
  lessonId: string;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonError(message: string, status = 400) {
  return noStoreJson({ ok: false, message }, status);
}

function envOrThrow(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isSafeId(v: string, max = 200) {
  return typeof v === "string" && v.length >= 1 && v.length <= max && /^[A-Za-z0-9_-]+$/.test(v);
}

function tsToMs(x: any): number | null {
  try {
    if (!x) return null;
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string") {
      const d = new Date(x);
      const ms = d.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof x?.toMillis === "function") {
      const ms = x.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof x?.toDate === "function") {
      const d = x.toDate();
      const ms = d?.getTime?.();
      return Number.isFinite(ms) ? ms : null;
    }
    return null;
  } catch {
    return null;
  }
}

function hasCourseAccess(userData: any, courseId: string) {
  const purchasedIds: string[] = Array.isArray(userData?.purchasedCourseIds)
    ? userData.purchasedCourseIds
    : [];

  const purchases = userData?.purchases ?? {};

  const inArray = purchasedIds.includes(courseId);
  const inMap = !!purchases?.[courseId];

  return inArray || inMap;
}

function isAdmin(userData: any) {
  return String(userData?.role || "").trim() === "admin";
}

function signToken(payload: Record<string, any>, secret: string) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function sanitizeContentType(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "video/mp4";

  if (
    s === "video/mp4" ||
    s === "video/webm" ||
    s === "video/ogg" ||
    s === "application/x-mpegurl" ||
    s === "application/vnd.apple.mpegurl"
  ) {
    return s;
  }

  if (s.startsWith("video/")) return s;
  return "video/mp4";
}

function isSafeStoragePath(v: string) {
  if (!v) return false;
  if (v.length > 1000) return false;
  if (v.includes("..")) return false;
  if (v.includes("\\")) return false;
  if (/^gs:\/\//i.test(v)) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (v.startsWith("/")) return false;
  if (!/^[A-Za-z0-9/_\-.]+$/.test(v)) return false;
  return true;
}

function storagePathMatchesCourseLesson(storagePath: string, courseId: string, lessonId: string) {
  const expectedA = `videos/courses/${courseId}/lessons/${lessonId}/`;
  const expectedB = `courses/${courseId}/lessons/${lessonId}/`;
  return storagePath.startsWith(expectedA) || storagePath.startsWith(expectedB);
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return jsonError("Missing Authorization: Bearer <idToken>", 401);

    const idToken = m[1].trim();
    if (!idToken) return jsonError("Empty idToken", 401);

    const decoded = await adminAuth().verifyIdToken(idToken, true);
    if (!decoded?.uid) return jsonError("Invalid token", 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    const courseId = String(body?.courseId || "").trim();
    const lessonId = String(body?.lessonId || "").trim();

    if (!isSafeId(courseId)) return jsonError("Invalid courseId", 400);
    if (!isSafeId(lessonId)) return jsonError("Invalid lessonId", 400);

    const db = adminDb();

    const [userSnap, courseSnap, lessonSnap] = await Promise.all([
      db.collection("users").doc(decoded.uid).get(),
      db.collection("courses").doc(courseId).get(),
      db.collection("courses").doc(courseId).collection("lessons").doc(lessonId).get(),
    ]);

    if (!userSnap.exists) return jsonError("User not found", 404);
    if (!courseSnap.exists) return jsonError("Course not found", 404);
    if (!lessonSnap.exists) return jsonError("Lesson not found", 404);

    const userData = userSnap.data() as any;
    const course = courseSnap.data() as any;
    const lesson = lessonSnap.data() as any;

    const admin = isAdmin(userData);

    if (!admin) {
      if (course?.isPublished !== true) return jsonError("Course not available", 403);
      if (lesson?.isPublished !== true) return jsonError("Lesson not available", 403);

      const purchased = hasCourseAccess(userData, courseId);
      if (!purchased) return jsonError("No access to this course", 403);

      const purchase = userData?.purchases?.[courseId] ?? null;
      const expMs = tsToMs(purchase?.expiresAt);
      if (expMs && Date.now() > expMs) {
        return jsonError("Course access expired", 403);
      }
    }

    const storagePath = String(
      lesson?.video?.storagePath ||
        lesson?.videoPath ||
        lesson?.storagePath ||
        ""
    ).trim();

    if (!storagePath) {
      return jsonError("Video storagePath missing", 400);
    }

    if (!isSafeStoragePath(storagePath)) {
      return jsonError("Invalid video storagePath", 400);
    }

    if (!storagePathMatchesCourseLesson(storagePath, courseId, lessonId)) {
      return jsonError("Video path mismatch", 403);
    }

    const contentType = sanitizeContentType(lesson?.video?.contentType);

    const secret = envOrThrow("VIDEO_STREAM_SECRET");

    // 2 цагийн токен — existing working behavior хэвээр
    const exp = Date.now() + 2 * 60 * 60 * 1000;
    const iat = Date.now();

    const token = signToken(
      {
        v: 2,
        iat,
        jti: crypto.randomUUID(),
        uid: decoded.uid,
        courseId,
        lessonId,
        p: storagePath,
        ct: contentType,
        exp,
      },
      secret
    );

    const origin = req.nextUrl.origin;
    const playUrl = `${origin}/api/course/video-stream?token=${encodeURIComponent(token)}`;

    return noStoreJson(
      {
        ok: true,
        playUrl,
        expiresAt: exp,
      },
      200
    );
  } catch (e: any) {
    console.error("[/api/course/video-access] ERROR:", e);
    return noStoreJson(
      { ok: false, message: "Видео нээх эрх шалгах үед алдаа гарлаа" },
      500
    );
  }
}