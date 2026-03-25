import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type StreamTokenPayload = {
  uid: string;
  courseId: string;
  lessonId: string;
  p: string;   // storagePath
  ct?: string; // contentType
  exp: number;

  // additive fields (хуучин token эвдэхгүй)
  v?: number;
  iat?: number;
  jti?: string;
};

type DestroyableReadable = NodeJS.ReadableStream & {
  destroy?: (error?: Error) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => any;
  on: (event: string, listener: (...args: any[]) => void) => any;
};

const entitlementCache = new Map<string, { ok: boolean; isAdmin: boolean; exp: number }>();
const ENTITLEMENT_CACHE_MS = 30_000;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getBucketName(): string {
  const raw =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "";

  const bucket = String(raw).trim();
  if (!bucket) {
    throw new Error(
      "Missing FIREBASE_STORAGE_BUCKET (or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)"
    );
  }

  return bucket.replace(/^gs:\/\//i, "").replace(/\/+$/, "");
}

function isSafeId(v: string, max = 120) {
  return /^[A-Za-z0-9_-]{1,120}$/.test(v) && v.length <= max;
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

function timingSafeEqualString(a: string, b: string) {
  const ab = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyToken(token: string, secret: string): StreamTokenPayload | null {
  try {
    const [data, sig] = String(token || "").split(".");
    if (!data || !sig) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    if (!timingSafeEqualString(sig, expected)) return null;

    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as StreamTokenPayload;

    if (!payload?.uid || !payload?.courseId || !payload?.lessonId || !payload?.p || !payload?.exp) {
      return null;
    }

    if (!isSafeId(String(payload.uid), 200)) return null;
    if (!isSafeId(String(payload.courseId))) return null;
    if (!isSafeId(String(payload.lessonId))) return null;

    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;

    const iat = Number(payload.iat);
    if (payload.iat != null && (!Number.isFinite(iat) || iat <= 0 || iat > Date.now() + 60_000)) {
      return null;
    }

    if (payload.v != null) {
      const v = Number(payload.v);
      if (!Number.isFinite(v) || v < 1 || v > 10) return null;
    }

    if (payload.jti != null) {
      const jti = String(payload.jti);
      if (!jti || jti.length > 200) return null;
    }

    const p = String(payload.p || "").trim();
    if (!isSafeStoragePath(p)) return null;
    if (!storagePathMatchesCourseLesson(p, String(payload.courseId), String(payload.lessonId))) {
      return null;
    }

    return {
      ...payload,
      p,
      ct: sanitizeContentType(payload.ct),
    };
  } catch {
    return null;
  }
}

function bad(status: number, message: string, extraHeaders?: Record<string, string>) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  });

  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }

  return new NextResponse(message, {
    status,
    headers,
  });
}

function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return { ok: true as const, range: null };

  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
  if (!m) return { ok: false as const, range: null };

  let start = m[1] === "" ? NaN : Number(m[1]);
  let end = m[2] === "" ? NaN : Number(m[2]);

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return { ok: false as const, range: null };
  }

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return { ok: false as const, range: null };
    }
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (Number.isNaN(end) || end >= size) end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false as const, range: null };
  }
  if (start < 0 || end < 0 || start > end || start >= size) {
    return { ok: false as const, range: null };
  }

  return { ok: true as const, range: { start, end } };
}

function safeDestroy(stream: DestroyableReadable) {
  try {
    stream.destroy?.();
  } catch {
    // ignore
  }
}

function nodeStreamToWebStream(
  rawNodeStream: NodeJS.ReadableStream
): ReadableStream<Uint8Array> {
  const nodeStream = rawNodeStream as DestroyableReadable;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = () => {
        try {
          nodeStream.removeListener?.("data", onData);
          nodeStream.removeListener?.("end", onEnd);
          nodeStream.removeListener?.("error", onError);
          nodeStream.removeListener?.("close", onClose);
        } catch {
          // ignore
        }
      };

      const onData = (chunk: Buffer | Uint8Array | string) => {
        if (closed) return;

        try {
          const buf =
            typeof chunk === "string"
              ? Buffer.from(chunk)
              : Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk);

          controller.enqueue(new Uint8Array(buf));
        } catch {
          closed = true;
          cleanup();
          safeDestroy(nodeStream);
        }
      };

      const onEnd = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const onClose = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const onError = (err: any) => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.error(err);
        } catch {
          // ignore
        }
      };

      nodeStream.on("data", onData);
      nodeStream.on("end", onEnd);
      nodeStream.on("close", onClose);
      nodeStream.on("error", onError);
    },

    cancel() {
      closed = true;
      safeDestroy(nodeStream);
    },
  });
}

function normalizeMs(value: any): number | null {
  if (!value) return null;

  if (typeof value?.toMillis === "function") {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) return value;

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValidPurchaseInUserDoc(userData: any, courseId: string) {
  const purchasedIds: string[] = Array.isArray(userData?.purchasedCourseIds)
    ? userData.purchasedCourseIds
    : [];

  if (purchasedIds.includes(courseId)) return true;

  const purchases = userData?.purchases;
  if (!purchases || typeof purchases !== "object") return false;

  const item = purchases[courseId];
  if (!item) return false;

  if (item === true) return true;

  if (typeof item === "object") {
    const expiresAtMs = normalizeMs(item?.expiresAt);
    if (expiresAtMs == null) return true;
    return expiresAtMs > Date.now();
  }

  return false;
}

async function getEntitlementState(uid: string, courseId: string) {
  const cacheKey = `${uid}:${courseId}`;
  const now = Date.now();
  const cached = entitlementCache.get(cacheKey);

  if (cached && cached.exp > now) {
    return { ok: cached.ok, isAdmin: cached.isAdmin };
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  const admin = String(userData?.role || "").trim() === "admin";
  if (admin) {
    entitlementCache.set(cacheKey, { ok: true, isAdmin: true, exp: now + ENTITLEMENT_CACHE_MS });
    return { ok: true, isAdmin: true };
  }

  if (hasValidPurchaseInUserDoc(userData, courseId)) {
    entitlementCache.set(cacheKey, { ok: true, isAdmin: false, exp: now + ENTITLEMENT_CACHE_MS });
    return { ok: true, isAdmin: false };
  }

  const purchasesSnap = await db
    .collection("purchases")
    .where("uid", "==", uid)
    .where("courseId", "==", courseId)
    .limit(5)
    .get();

  if (!purchasesSnap.empty) {
    for (const d of purchasesSnap.docs) {
      const p = d.data() as any;

      if (p?.status && String(p.status).toUpperCase() === "CANCELLED") continue;
      if (p?.paid === false) continue;

      const expiresAtMs = normalizeMs(p?.expiresAt);
      if (expiresAtMs == null || expiresAtMs > now) {
        entitlementCache.set(cacheKey, { ok: true, isAdmin: false, exp: now + ENTITLEMENT_CACHE_MS });
        return { ok: true, isAdmin: false };
      }
    }
  }

  entitlementCache.set(cacheKey, { ok: false, isAdmin: false, exp: now + 5000 });
  return { ok: false, isAdmin: false };
}

function buildCommonHeaders(contentType: string) {
  return new Headers({
    "Content-Type": sanitizeContentType(contentType),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Content-Disposition": 'inline; filename="video.mp4"',
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  });
}

async function handle(req: NextRequest, method: "GET" | "HEAD") {
  try {
    const token = String(req.nextUrl.searchParams.get("token") || "").trim();
    if (!token) return bad(401, "Missing token");

    const secret = envOrThrow("VIDEO_STREAM_SECRET");
    const payload = verifyToken(token, secret);
    if (!payload) return bad(401, "Invalid or expired token");

    const entitlement = await getEntitlementState(payload.uid, payload.courseId);
    if (!entitlement.ok) return bad(403, "Access denied");

    const db = adminDb();

    const [courseSnap, lessonSnap] = await Promise.all([
      db.collection("courses").doc(payload.courseId).get(),
      db.collection("courses").doc(payload.courseId).collection("lessons").doc(payload.lessonId).get(),
    ]);

    if (!courseSnap.exists) return bad(404, "Course not found");
    if (!lessonSnap.exists) return bad(404, "Lesson not found");

    const course = courseSnap.data() as any;
    const lesson = lessonSnap.data() as any;

    if (!entitlement.isAdmin) {
      if (course?.isPublished !== true) return bad(403, "Course not available");
      if (lesson?.isPublished !== true) return bad(403, "Lesson not available");
    }

    const lessonStoragePath = String(
      lesson?.video?.storagePath ||
        lesson?.videoPath ||
        lesson?.storagePath ||
        ""
    ).trim();

    if (!lessonStoragePath) return bad(400, "Video storagePath missing");
    if (!isSafeStoragePath(lessonStoragePath)) return bad(400, "Invalid video path");
    if (!storagePathMatchesCourseLesson(lessonStoragePath, payload.courseId, payload.lessonId)) {
      return bad(403, "Video path mismatch");
    }
    if (lessonStoragePath !== payload.p) return bad(403, "Token path mismatch");

    const bucketName = getBucketName();
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(payload.p);

    const [exists] = await file.exists();
    if (!exists) return bad(404, "Video not found");

    const [meta] = await file.getMetadata();
    const size = Number(meta.size || 0);
    if (!Number.isFinite(size) || size <= 0) return bad(404, "Empty video");

    const contentType = sanitizeContentType(payload.ct || meta.contentType || "video/mp4");
    const rangeHeader = req.headers.get("range");
    const parsed = parseRange(rangeHeader, size);

    if (!parsed.ok) {
      return bad(416, "Invalid Range", {
        "Content-Range": `bytes */${size}`,
      });
    }

    const commonHeaders = buildCommonHeaders(contentType);

    if (method === "HEAD") {
      if (parsed.range) {
        const { start, end } = parsed.range;
        commonHeaders.set("Content-Range", `bytes ${start}-${end}/${size}`);
        commonHeaders.set("Content-Length", String(end - start + 1));

        return new NextResponse(null, {
          status: 206,
          headers: commonHeaders,
        });
      }

      commonHeaders.set("Content-Length", String(size));
      return new NextResponse(null, {
        status: 200,
        headers: commonHeaders,
      });
    }

    if (parsed.range) {
      const { start, end } = parsed.range;
      const chunkSize = end - start + 1;

      const nodeStream = file.createReadStream({ start, end });
      const webStream = nodeStreamToWebStream(nodeStream);

      commonHeaders.set("Content-Range", `bytes ${start}-${end}/${size}`);
      commonHeaders.set("Content-Length", String(chunkSize));

      return new NextResponse(webStream, {
        status: 206,
        headers: commonHeaders,
      });
    }

    const nodeStream = file.createReadStream();
    const webStream = nodeStreamToWebStream(nodeStream);

    commonHeaders.set("Content-Length", String(size));

    return new NextResponse(webStream, {
      status: 200,
      headers: commonHeaders,
    });
  } catch (e) {
    console.error("[/api/course/video-stream] ERROR:", e);
    return bad(500, "Stream error");
  }
}

export async function GET(req: NextRequest) {
  return handle(req, "GET");
}

export async function HEAD(req: NextRequest) {
  return handle(req, "HEAD");
}