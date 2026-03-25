"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import QPayModal from "@/components/QPayModal";

type Course = {
  title: string;
  price: number;
  oldPrice?: number;
  thumbnailUrl?: string;

  durationDays?: number;
  durationLabel?: number | string;
  duration?: string;

  shortDescription?: string;
  description?: string;

  whoForText?: string;
  learnText?: string;

  whoFor?: string[];
  learn?: string[];
};

type Lesson = {
  id: string;
  title: string;
  order?: number;
  durationSec?: number;
  description?: string;

  storagePath?: string;
  videoPath?: string;
  videoUrl?: string;

  video?: {
    storagePath?: string;
    contentType?: string;
    size?: number;
    uploadedAt?: any;
    originalName?: string;
  };
};

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString("mn-MN") : "0");

function fmtDuration(sec?: number) {
  if (!sec || !Number.isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function splitLines(text?: string) {
  if (!text) return [];
  return text
    .split("\n")
    .map((t) => t.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black text-black/95 tracking-tight">{title}</div>
      </div>

      <div className="mt-4 h-px w-full bg-black/8" />

      <ul className="mt-4 space-y-2 text-sm text-black/55">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[2px] text-black/25">•</span>
            <span className="leading-relaxed">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileInfoBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-none border-0 bg-transparent p-0">
      <div className="flex items-center justify-between">
        <div className="text-[13px] sm:text-base font-black text-black tracking-[-0.02em] leading-snug">
          {title}
        </div>
      </div>

      <div className="mt-1 h-px w-full bg-black/8" />

      <ul className="mt-4 space-y-3 text-sm text-black/45 text-[13px]">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-[2px] text-black/25">•</span>
            <span className="leading-relaxed">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatExpiresText(ms?: number | null) {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function renderTextWithLinksAndBreaks(text: string) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+|\n)/g);

  return parts.map((part, i) => {
    if (part === "\n") return <br key={`br-${i}`} />;

    const isUrl = /^https?:\/\/[^\s]+$/.test(part);
    if (isUrl) {
      return (
        <a
          key={`a-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-black underline underline-offset-2 hover:text-black/80 transition"
        >
          {part}
        </a>
      );
    }

    return <span key={`t-${i}`}>{part}</span>;
  });
}

// ── VideoThumbnail: renders a video frame at ~3s from a pre-fetched signed URL ─
function VideoThumbnail({
  url,
  className,
}: {
  url: string | null | undefined;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={`${className ?? ""} flex items-center justify-center bg-black/8`}>
        <svg className="h-5 w-5 text-black/20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    );
  }

  return (
    <video
      src={url}
      className={`${className ?? ""} object-cover`}
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        v.currentTime = Math.min(3, (v.duration || 0) * 0.1 || 1);
      }}
    />
  );
}

export default function CoursePage() {
  const router = useRouter();

  const params = useParams<{ id?: string }>();
  const courseId = String(params?.id ?? "").trim();

  const { user, loading, purchasedCourseIds } = useAuth();

  const isPurchased = useMemo(() => {
    if (!courseId) return false;
    return purchasedCourseIds.includes(courseId);
  }, [purchasedCourseIds, courseId]);

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const [fetching, setFetching] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);

  const [tab, setTab] = useState<"list" | "desc">("list");
  const [npTab, setNpTab] = useState<"details" | "content">("content");

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    return lessons.find((l) => l.id === selectedLessonId) ?? null;
  }, [selectedLessonId, lessons]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [expiryChecked, setExpiryChecked] = useState(false);
  const [reloadPurchaseKey, setReloadPurchaseKey] = useState(0);

  const canAccess = isPurchased && !isExpired;

  const [buyOpen, setBuyOpen] = useState(false);
  const [qpayData, setQpayData] = useState<{
    ref: string;
    qrImageDataUrl?: string | null;
    qr_image?: string | null;
    shortUrl?: string | null;
    urls?: Deeplink[];
    durationLabel?: string | null;
    durationDays?: number | null;
  } | null>(null);

  const amount = useMemo(() => Number(course?.price ?? 0), [course?.price]);

  function guardLogin(): boolean {
    if (user) return true;
    router.push(`/login?callbackUrl=${encodeURIComponent(`/course/${courseId}`)}`);
    return false;
  }

  async function createCheckoutInvoice() {
    if (!guardLogin()) return;
    if (!courseId) return;

    if (!Number.isFinite(amount) || amount <= 0) {
      setToast("Үнэ буруу байна. Admin дээр course price-аа шалгаарай.");
      return;
    }

    const modalDurationLabel =
      String(course?.durationLabel ?? "").trim() ||
      String(course?.duration ?? "").trim() ||
      (Number.isFinite(Number(course?.durationDays)) && Number(course?.durationDays) > 0
        ? `${Number(course?.durationDays)} хоногоор`
        : "30 хоногоор");

    const modalDurationDays =
      Number.isFinite(Number(course?.durationDays)) && Number(course?.durationDays) > 0
        ? Number(course?.durationDays)
        : null;

    setQpayData({
      ref: "",
      qrImageDataUrl: null,
      shortUrl: null,
      urls: [],
      durationLabel: modalDurationLabel,
      durationDays: modalDurationDays,
    });

    setBuyOpen(true);
  }

  useEffect(() => {
    if (loading) return;
    if (!courseId) return;

    const run = async () => {
      setFetching(true);
      try {
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        if (!courseSnap.exists()) {
          router.replace("/");
          return;
        }
        setCourse(courseSnap.data() as Course);

        // Use server API so Firestore rules don't block non-purchased/non-logged-in users
        const lessonsRes = await fetch(`/api/course/lessons?courseId=${encodeURIComponent(courseId)}`, {
          cache: "no-store",
        });
        const lessonsData = lessonsRes.ok ? await lessonsRes.json().catch(() => null) : null;

        const list: Lesson[] = Array.isArray(lessonsData?.lessons)
          ? (lessonsData.lessons as Lesson[])
          : [];

        setLessons(list);

        if (list.length > 0) setSelectedLessonId(list[0].id);

        // Batch-fetch all thumbnail signed URLs in parallel so they're ready instantly
        const lessonsWithVideo = list.filter(
          (l) => !!(l.videoPath || (l.video as any)?.storagePath)
        );
        if (lessonsWithVideo.length > 0) {
          const entries = await Promise.all(
            lessonsWithVideo.map((l) =>
              fetch("/api/course/lesson-thumbnail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, lessonId: l.id }),
              })
                .then((r) => r.json())
                .then((data) => (data?.ok && data.url ? [l.id, data.url as string] as const : null))
                .catch(() => null)
            )
          );
          const map: Record<string, string> = {};
          for (const e of entries) { if (e) map[e[0]] = e[1]; }
          setThumbnailUrls(map);
        }
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, courseId, router]);

  useEffect(() => {
    const run = async () => {
      if (!isPurchased) {
        setExpiresAtMs(null);
        setIsExpired(false);
        setExpiryChecked(true);
        return;
      }
      if (!user?.uid || !courseId) {
        setExpiryChecked(true);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const data = userSnap.exists() ? (userSnap.data() as any) : null;

        const p = data?.purchases?.[courseId] ?? null;

        const purchasedMs = tsToMs(p?.purchasedAt);
        const expMsRaw = tsToMs(p?.expiresAt);

        const ddFromPurchase = Number(p?.durationDays);
        const ddFromCourse = Number(course?.durationDays);
        const durationDays =
          (Number.isFinite(ddFromPurchase) && ddFromPurchase > 0 ? ddFromPurchase : null) ??
          (Number.isFinite(ddFromCourse) && ddFromCourse > 0 ? ddFromCourse : null) ??
          30;

        let finalExpMs: number | null = expMsRaw ?? null;

        if (purchasedMs && (!finalExpMs || (finalExpMs && finalExpMs < purchasedMs))) {
          finalExpMs = purchasedMs + durationDays * 24 * 60 * 60 * 1000;

          try {
            await updateDoc(doc(db, "users", user.uid), {
              [`purchases.${courseId}.expiresAt`]: Timestamp.fromMillis(finalExpMs),
              [`purchases.${courseId}.durationDays`]: durationDays,
              [`purchases.${courseId}.updatedAt`]: serverTimestamp(),
            });
          } catch {
            // silent
          }
        }

        setExpiresAtMs(finalExpMs);

        if (finalExpMs && Date.now() > finalExpMs) setIsExpired(true);
        else setIsExpired(false);
      } catch (e) {
        console.error("load purchase expiry error:", e);
        setExpiresAtMs(null);
        setIsExpired(false);
      } finally {
        setExpiryChecked(true);
      }
    };

    run();
  }, [isPurchased, user?.uid, courseId, course?.durationDays, reloadPurchaseKey]);

  useEffect(() => {
    if (!expiresAtMs) return;

    const msLeft = expiresAtMs - Date.now();
    if (msLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const t = setTimeout(() => {
      setIsExpired(true);
      setToast("⛔ Сургалтын хугацаа дууслаа");
    }, msLeft);

    return () => clearTimeout(t);
  }, [expiresAtMs]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      setVideoSrc(null);

      if (!canAccess) return;
      if (!selectedLessonId) return;
      if (!user) return;

      const lesson = lessons.find((l) => l.id === selectedLessonId);
      if (!lesson) return;

      const storagePath = lesson.video?.storagePath || lesson.videoPath || lesson.storagePath;

      if (!storagePath) {
        setVideoSrc(null);
        return;
      }

      setVideoLoading(true);
      try {
        const idToken = await user.getIdToken();

        const res = await fetch("/api/course/video-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            courseId,
            lessonId: selectedLessonId,
          }),
          signal: ac.signal,
          cache: "no-store",
        });

        const data: any = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          if (!cancelled) {
            setVideoSrc(null);
            setToast(data?.message || "Видео нээхэд алдаа гарлаа.");
          }
          return;
        }

        const playUrl = String(data?.playUrl || "").trim();
        if (!playUrl) {
          if (!cancelled) {
            setVideoSrc(null);
            setToast("Видео playback URL олдсонгүй.");
          }
          return;
        }

        if (!cancelled) {
          setVideoSrc(playUrl);
        }
      } catch (e: any) {
        if (!cancelled && !/aborted|abort/i.test(String(e?.message || ""))) {
          console.error("video-access error:", e);
          setVideoSrc(null);
          setToast("Видео нээхэд алдаа гарлаа.");
        }
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedLessonId, lessons, canAccess, user, courseId]);

  if (fetching || (isPurchased && !expiryChecked)) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-black bg-white min-h-[calc(100vh-80px)]">
        Уншиж байна...
      </div>
    );
  }
  if (!course) return null;

  const durationLabel =
    String(course.durationLabel || "").trim() ||
    String(course.duration || "").trim() ||
    (Number.isFinite(Number(course.durationDays)) && Number(course.durationDays) > 0
      ? `${Number(course.durationDays)} хоног`
      : "30 хоног");

  const whoForItems = course.whoFor?.length ? course.whoFor : splitLines(course.whoForText);
  const learnItems = course.learn?.length ? course.learn : splitLines(course.learnText);

  const whoForFallback = [
    "AI ашиглаж орлого олох зорилготой хүмүүс",
    "Видео/контент хийж сошиалд өсөх хүсэлтэй",
    "Freelance / онлайн ур чадвар нэмэх гэж байгаа",
    "Юунаас эхлэхээ мэдэхгүй байсан ч системтэй сурах хүмүүс",
  ];

  const learnFallback = [
    "AI-аар зураг/видео/контент хийх бодит workflow",
    "Free + Pro tool-уудыг зөв хослуулж ашиглах",
    "Reels/Ads-д тохирсон контент бүтэц, темп",
    "Бэлэн жишээн дээр давтаж хийж сурах",
  ];

  if (canAccess) {
    return (
      <div className="lesson-viewer min-h-[calc(100vh-80px)]">
        <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-16">
          <div className="flex justify-center">
            <div className="w-full max-w-3xl px-6 py-2 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-black">
                {course.title}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[12px] md:text-sm font-semibold text-black">Видео үзэх</div>

                <div className="text-[11px] md:text-xs flex items-center gap-2">
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-50 px-2 md:px-3 py-0.5 md:py-1 text-emerald-700 font-semibold">
                    + {durationLabel}
                  </span>

                  {expiresAtMs ? (
                    <span className="rounded-full border border-black/10 bg-black/5 px-2 md:px-3 py-0.5 md:py-1 text-black/60 font-medium">
                      Дуусах: {formatExpiresText(expiresAtMs)}
                    </span>
                  ) : null}
                </div>
              </div>

              {videoLoading ? (
                <div className="rounded-xl border border-black/8 bg-black/5 p-8 text-center text-sm text-black/50">
                  Видеог ачаалж байна...
                </div>
              ) : videoSrc ? (
                <div className="overflow-hidden rounded-xl bg-black shadow-[0_4px_24px_rgba(0,0,0,0.18)]">
                  <video
                    ref={videoRef}
                    key={videoSrc}
                    src={videoSrc}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black"
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-black/8 bg-black/5 p-8 text-center text-sm text-black/50">
                  Энэ хичээлд видео холбоогүй байна.
                </div>
              )}

              {selectedLesson && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black text-black tracking-wide">
                    ОДОО
                  </span>
                  <span className="text-[13px] font-bold text-black truncate">
                    {(lessons.findIndex((x) => x.id === selectedLesson.id) + 1)}.{" "}
                    {selectedLesson.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl grid grid-cols-2 gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setTab("list")}
                className={[
                  "h-10 rounded-xl text-center text-[12px] font-extrabold tracking-wide transition-all duration-200",
                  tab === "list"
                    ? "bg-black/5 text-black border border-black/10"
                    : "text-black/50 hover:text-black",
                ].join(" ")}
              >
                ХИЧЭЭЛИЙН ЖАГСААЛТ
              </button>

              <button
                type="button"
                onClick={() => setTab("desc")}
                className={[
                  "h-10 rounded-xl text-center text-[12px] font-extrabold tracking-wide transition-all duration-200",
                  tab === "desc"
                    ? "bg-black/5 text-black border border-black/10"
                    : "text-black/50 hover:text-black",
                ].join(" ")}
              >
                ХИЧЭЭЛИЙН ТАЙЛБАР
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-black/10 bg-white shadow-sm">
              <div className="p-4">
                {tab === "desc" ? (
                  <div className="min-h-[260px] rounded-xl border border-black/8 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="text-sm font-bold text-black">
                      {selectedLesson ? (
                        <>
                          {lessons.findIndex((x) => x.id === selectedLesson.id) + 1}.{" "}
                          <span className="text-black font-extrabold tracking-wide">
                            {selectedLesson.title}
                          </span>
                        </>
                      ) : (
                        <span className="text-black">Хичээл сонгоогүй байна.</span>
                      )}
                    </div>

                    <div className="mt-4 text-sm leading-7 text-black whitespace-pre-wrap">
                      {selectedLesson?.description?.trim()
                        ? renderTextWithLinksAndBreaks(selectedLesson.description)
                        : "Тайлбар оруулаагүй байна."}
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[440px] overflow-auto pr-1">
                    {lessons.length === 0 ? (
                      <div className="rounded-xl border border-black/8 bg-white p-6 text-black shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        Одоогоор хичээл алга.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lessons.map((l, idx) => {
                          const active = l.id === selectedLessonId;
                          const t = fmtDuration(l.durationSec);

                          return (
                            <button
                              key={l.id}
                              onClick={() => setSelectedLessonId(l.id)}
                              className={[
                                "group w-full rounded-2xl border text-left transition-all duration-200",
                                "focus:outline-none",
                                active
                                  ? "border-black/15 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
                                  : "border-black/8 bg-white hover:border-black/15 hover:bg-black/[0.015]",
                              ].join(" ")}
                            >
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className={[
                                  "shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-black transition-all",
                                  active ? "bg-black text-white" : "bg-black/8 text-black/35",
                                ].join(" ")}>
                                  {idx + 1}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-black text-black leading-snug truncate">
                                    {l.title}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-black/40">
                                    {active ? "Одоо үзэж байна" : ""}
                                  </div>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  {t ? (
                                    <div className="text-[11px] font-semibold text-black/45">{t}</div>
                                  ) : (
                                    <div className="text-[11px] text-black/25">—</div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {toast ? (
              <div className="fixed right-4 top-4 z-[60] rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-sm text-black backdrop-blur">
                {toast}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="lg:hidden min-h-[calc(100vh-80px)] bg-white text-black overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-12">
          {course.thumbnailUrl ? (
            <div className="mx-auto w-full overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-sm">
              <div className="relative aspect-video w-full">
                <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center gap-3">
              <div className="mt-[10px] h-5 w-[2px] rounded-full bg-black/20" />
              <div className="text-xs font-extrabold tracking-wide text-black">Эхлэл</div>
            </div>

            <div className="mt-3 min-w-0">
              <div className="text-xl font-extrabold text-black leading-snug">{course.title}</div>

              <div className="mt-2 text-sm leading-4 text-black/60">
                {course.shortDescription?.trim()
                  ? course.shortDescription
                  : course.description?.trim()
                  ? course.description
                  : "Энэ сургалтаар системтэйгээр үзэж, давтаж хийж сурна."}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="relative rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[14px] font-extrabold text-black">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-black/70">
                    <span className="h-2.5 w-2.5 rounded-full bg-black/70" />
                  </span>
                  <span className="tracking-wide">{durationLabel}</span>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold tracking-tight text-black">
                    {money(Number(course.price ?? 0))}₮
                  </div>

                  {course.oldPrice ? (
                    <div className="mt-0.5 text-sm font-bold line-through text-black">
                      {money(Number(course.oldPrice))}₮
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  createCheckoutInvoice();
                }}
                className="
                  mt-3 w-full rounded-2xl
                  px-5 py-3
                  text-[13px] font-extrabold uppercase tracking-wide
                  text-black
                  bg-gradient-to-r from-cyan-400 to-blue-500
                  shadow-[0_10px_24px_rgba(0,120,255,0.22)]
                  hover:from-cyan-300 hover:to-blue-400
                  transition-all duration-300
                "
              >
                Худалдан авах
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setNpTab("content")}
                className={[
                  "h-9 rounded-xl text-center text-[11px] font-extrabold tracking-wide transition",
                  npTab === "content" ? "bg-black/5 text-black border border-black/10" : "text-black hover:text-black",
                ].join(" ")}
              >
                Хичээлүүд
              </button>

              <button
                type="button"
                onClick={() => setNpTab("details")}
                className={[
                  "h-9 rounded-xl text-center text-[11px] font-extrabold tracking-wide transition",
                  npTab === "details" ? "bg-black/5 text-black border border-black/10" : "text-black hover:text-black",
                ].join(" ")}
              >
                Дэлгэрэнгүй мэдээлэл
              </button>
            </div>

            <div className="mt-4">
              {npTab === "content" ? (
                <div className="space-y-3">
                  {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-6 text-black shadow-sm">
                      Одоогоор lesson алга.
                    </div>
                  ) : (
                    lessons.map((l, idx) => {
                      const t = fmtDuration(l.durationSec);
                      return (
                        <div
                          key={l.id}
                          className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5">
                            <VideoThumbnail url={thumbnailUrls[l.id]} className="h-full w-full" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 whitespace-normal break-words text-[11px] font-black text-black tracking-[-0.03em] leading-tight">
                              {idx + 1}. {l.title}
                            </div>
                            <div className="mt-1 line-clamp-4 text-[11px] text-black/45">
                              {l.description?.trim() ? l.description : "Худалдаж авсны дараа энэ хичээл нээгдэнэ."}
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-xs font-bold text-black">{t ? t : "—"}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-black/20 bg-white p-5 space-y-6 shadow-[0_10px_30px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
                  <MobileInfoBlock
                    title="Энэ сургалтанд ямар ямар хичээлүүд багтсан бэ?"
                    items={whoForItems.length ? whoForItems : whoForFallback}
                  />
                  <MobileInfoBlock
                    title="Та энэ сургалтыг авсанаар юу сурах вэ?"
                    items={learnItems.length ? learnItems : learnFallback}
                  />
                </div>
              )}
            </div>
          </div>

          {toast ? (
            <div className="fixed right-4 top-4 z-[60] rounded-xl border border-black/10 bg-white/95 px-4 py-2 text-sm text-black shadow-sm">
              {toast}
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden lg:block min-h-[calc(100vh-80px)] bg-white text-black overflow-x-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_50%_0%,rgba(0,140,255,0.10),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(700px_420px_at_15%_35%,rgba(34,211,238,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(700px_420px_at_85%_70%,rgba(99,102,241,0.10),transparent_55%)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-12">
          <div className="hidden lg:block">
            {course.thumbnailUrl ? (
              <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
                <div className="relative aspect-video w-full">
                  <img
                    src={course.thumbnailUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-35"
                  />
                  <div className="absolute inset-0 bg-white/55" />
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="relative z-10 h-full w-full object-contain"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section className="px-1">
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <div className="mt-[10px] h-5 w-[2px] rounded-full bg-black/15" />
                    <div className="text-xs font-extrabold tracking-wide text-black">Эхлэл</div>
                  </div>

                  <div className="mt-2 flex gap-3">
                    <div className="mt-[8px] h-7 w-[2px] rounded-full bg-black/10" />
                    <div className="min-w-0">
                      <div className="truncate text-xl font-extrabold text-black">{course.title}</div>
                      <div className="mt-2 text-sm leading-5 text-black/60">
                        {course.shortDescription?.trim()
                          ? course.shortDescription
                          : course.description?.trim()
                          ? course.description
                          : "Энэ сургалтаар системтэйгээр үзэж, давтаж хийж сурна."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-px w-full bg-black/10" />
                </div>

                <div className="space-y-4">
                  {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-6 text-black shadow-sm">
                      Одоогоор lesson алга.
                    </div>
                  ) : (
                    lessons.map((l, idx) => {
                      const t = fmtDuration(l.durationSec);

                      return (
                        <div
                          key={l.id}
                          className={[
                            "flex items-center gap-5",
                            "rounded-3xl border border-black/10",
                            "bg-white px-6 py-6",
                            "min-h-[120px]",
                            "shadow-sm hover:shadow-md transition",
                          ].join(" ")}
                        >
                          <div className="h-16 w-28 overflow-hidden rounded-2xl border border-black/10 bg-black/5">
                            <VideoThumbnail url={thumbnailUrls[l.id]} className="h-full w-full" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate text-[12px] !font-black !text-black tracking-[0.01em]"
                              style={{ fontWeight: 800 }}
                            >
                              {idx + 1}. {l.title}
                            </div>

                            <div className="mt-2 line-clamp-3 text-xs text-black/50 leading-relaxed">
                              {l.description?.trim() ? l.description : "Худалдаж авсны дараа энэ хичээл нээгдэнэ."}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-xs font-extrabold text-black">{t ? t : "—"}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className="space-y-5 lg:sticky lg:top-24 h-fit">
                <div className="space-y-5">
                  <div
                    className="
                      relative
                      rounded-2xl
                      border
                      border-cyan-300/80
                      bg-white
                      p-6
                      shadow-[
                        inset_0_0_10px_rgba(34,211,238,0.22),
                        0_10px_30px_rgba(0,0,0,0.08),
                        0_0_22px_rgba(34,211,238,0.18)
                      ]
                      transition-all
                      duration-300
                      hover:border-cyan-300
                      hover:shadow-[
                        inset_0_0_14px_rgba(34,211,238,0.28),
                        0_14px_40px_rgba(0,0,0,0.10),
                        0_0_30px_rgba(34,211,238,0.22)
                      ]
                    "
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-lg font-extrabold text-black">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-black/70">
                          <span className="h-2.5 w-2.5 rounded-full bg-black/70" />
                        </span>
                        <span className="tracking-wide">{durationLabel}</span>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-extrabold tracking-tight text-black">
                          {money(Number(course.price ?? 0))}₮
                        </div>

                        {course.oldPrice && (
                          <div className="mt-0.5 text-sm font-extrabold line-through text-black">
                            {money(Number(course.oldPrice))}₮
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        createCheckoutInvoice();
                      }}
                      className="
                        w-full rounded-full
                        px-6 py-4
                        text-sm font-extrabold uppercase tracking-wide
                        text-black
                        bg-gradient-to-r from-cyan-400 to-blue-400
                        shadow-[0_12px_28px_rgba(0,120,255,0.25)]
                        hover:from-cyan-300 hover:to-blue-400
                        hover:shadow-[0_14px_34px_rgba(0,120,255,0.30)]
                        transition-all duration-300
                      "
                    >
                      ХУДАЛДАЖ АВАХ
                    </button>
                  </div>
                </div>

                <InfoBlock
                  title="Энэ сургалтанд ямар ямар хичээлүүд багтсан бэ?"
                  items={whoForItems.length ? whoForItems : whoForFallback}
                />
                <InfoBlock
                  title="Та энэ сургалтыг авсанаар юу сурах вэ?"
                  items={learnItems.length ? learnItems : learnFallback}
                />
              </aside>
            </div>
          </div>

          {toast ? (
            <div className="fixed right-4 top-4 z-[60] rounded-xl border border-black/10 bg-white/95 px-4 py-2 text-sm text-black shadow-sm">
              {toast}
            </div>
          ) : null}
        </div>
      </div>

      <QPayModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        data={qpayData}
        amount={amount}
        courseTitle={course.title}
        courseThumbUrl={course.thumbnailUrl ?? null}
        courseId={courseId}
        onPaid={() => {
          setToast("✅ Төлбөр баталгаажлаа. Сургалт нээгдлээ!");
          setBuyOpen(false);
          setIsExpired(false);
          setExpiresAtMs(null);
          setReloadPurchaseKey((k) => k + 1);
          router.refresh();
        }}
      />
    </>
  );
}