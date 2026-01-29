"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { grantPurchase } from "@/lib/purchase";
import { calcCoursePercent, isLessonCompleted, setLessonWatchedSec } from "@/lib/progress";

type Course = {
  title: string;
  price: number;
  oldPrice?: number;

  thumbnailUrl?: string;

  // ✅ NEW fields
  durationDays?: number; // e.g. 30
  durationLabel?: string; // e.g. "30 хоног", "1 сар"
  shortDescription?: string;

  // хуучин field байж болно (эвдэхгүй)
  description?: string;

  // ✅ Course detail sections
  whoForText?: string; // multiline text
  learnText?: string; // multiline text

  // хуучин array хэлбэр (эвдэхгүй)
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
    downloadUrl?: string;
    contentType?: string;
    size?: number;
    uploadedAt?: any;
    originalName?: string;
  };
};

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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-white/70">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[2px] text-white/35">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const { user, loading, purchasedCourseIds } = useAuth();

  const isPurchased = useMemo(
    () => purchasedCourseIds.includes(courseId),
    [purchasedCourseIds, courseId]
  );

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const [fetching, setFetching] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [mockBuying, setMockBuying] = useState(false);

  // ✅ purchased view tab
  const [tab, setTab] = useState<"list" | "desc">("list");

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

  // ✅ PROGRESS states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [coursePercent, setCoursePercent] = useState(0);
  const lastSaveRef = useRef(0);

  // fetch course + lessons
  useEffect(() => {
    if (loading) return;

    const run = async () => {
      setFetching(true);
      try {
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        if (!courseSnap.exists()) {
          router.replace("/");
          return;
        }
        setCourse(courseSnap.data() as Course);

        const lessonsQ = query(
          collection(db, "courses", courseId, "lessons"),
          orderBy("order", "asc")
        );
        const lessonsSnap = await getDocs(lessonsQ);

        const list: Lesson[] = [];
        lessonsSnap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setLessons(list);

        if (list.length > 0) setSelectedLessonId(list[0].id);
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, courseId, router]);

  // fetch videoSrc on lesson change
  useEffect(() => {
    const run = async () => {
      setVideoSrc(null);

      if (!isPurchased) return;
      if (!selectedLessonId) return;

      const lesson = lessons.find((l) => l.id === selectedLessonId);
      if (!lesson) return;

      const directUrl = lesson.videoUrl || lesson.video?.downloadUrl;
      if (directUrl) {
        setVideoSrc(directUrl);
        return;
      }

      const storagePath = lesson.video?.storagePath || lesson.videoPath || lesson.storagePath;
      if (!storagePath) {
        setVideoSrc(null);
        return;
      }

      setVideoLoading(true);
      try {
        const url = await getDownloadURL(ref(storage, storagePath));
        setVideoSrc(url);
      } catch (e) {
        console.error("getDownloadURL error:", e);
        setVideoSrc(null);
      } finally {
        setVideoLoading(false);
      }
    };

    run();
  }, [selectedLessonId, lessons, isPurchased]);

  // recalc percent when lessons ready / change
  useEffect(() => {
    if (!isPurchased) return;
    if (!courseId) return;
    if (!lessons.length) return;

    const pct = calcCoursePercent({ courseId, lessons, fallbackDurationSec: 300 });
    setCoursePercent(pct);
  }, [isPurchased, courseId, lessons, selectedLessonId]);

  const handleBuyNow = async () => {
    if (!user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/course/${courseId}`)}`);
      return;
    }
    try {
      setMockBuying(true);
      await grantPurchase(courseId);
      setToast("✅ Сургалт нээгдлээ");
    } finally {
      setMockBuying(false);
    }
  };

  if (fetching) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-white/70">Уншиж байна...</div>;
  }
  if (!course) return null;

  const durationLabel =
    (course.durationLabel || "").trim() ||
    (Number.isFinite(Number(course.durationDays)) && Number(course.durationDays) > 0
      ? `${Number(course.durationDays)} хоног`
      : "30 хоног");

  const whoForItems = course.whoFor?.length ? course.whoFor : splitLines(course.whoForText);
  const learnItems = course.learn?.length ? course.learn : splitLines(course.learnText);

  // fallback (эвдэхгүй)
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

  // =========================================================
  // ✅ PURCHASED VIEW
  // =========================================================
  if (isPurchased) {
    return (
      <div
        className="min-h-[calc(100vh-80px)] text-white"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 0%, rgba(17,67,132,0.55), rgba(3,18,42,0.95)), radial-gradient(circle at 10% 20%, rgba(0,140,255,0.18), transparent 45%), radial-gradient(circle at 90% 80%, rgba(0,255,170,0.10), transparent 55%)",
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 opacity-55"
          style={{
            backgroundImage: "radial-gradient(rgba(120,200,255,0.28) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            backgroundPosition: "0 0",
            maskImage: "radial-gradient(700px 520px at 50% 30%, black 60%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(700px 520px at 50% 30%, black 60%, transparent 100%)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-16">
          {/* ✅ title only */}
          <div className="flex justify-center">
            <div className="w-full max-w-3xl rounded-full bg-black/25 px-6 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.35)] border border-white/10">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-yellow-400">
                {course.title}
              </div>
            </div>
          </div>

          {/* ✅ PROGRESS (Skool style) */}
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/85">Таны ахиц</div>
                <div className="text-sm font-extrabold text-white">{coursePercent}%</div>
              </div>

              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                  style={{ width: `${coursePercent}%` }}
                />
              </div>

              <div className="mt-2 text-xs text-white/55">
                {coursePercent < 20
                  ? "Эхэлж байна — 1–2 хичээл үзэхэд ахиц мэдрэгдэнэ."
                  : coursePercent < 70
                  ? "Сайн явж байна — тогтмол үзвэл хурдан дуусна."
                  : coursePercent < 100
                  ? "Бараг дууслаа — сүүлийн хэсгээ хийчих!"
                  : "Дууссан ✅"}
              </div>
            </div>
          </div>

          {/* ✅ VIDEO */}
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-amber-300/25 bg-black/20 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.40)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">Видео үзэх</div>

                <div className="text-xs">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                    Хугацаа: {durationLabel}
                  </span>
                </div>
              </div>

              {videoLoading ? (
                <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-white/70">
                  Видеог ачаалж байна...
                </div>
              ) : videoSrc ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
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
                    onLoadedMetadata={() => {
                      const pct = calcCoursePercent({ courseId, lessons, fallbackDurationSec: 300 });
                      setCoursePercent(pct);
                    }}
                    onTimeUpdate={(e) => {
                      if (!selectedLessonId) return;

                      const now = Date.now();
                      if (now - lastSaveRef.current < 3000) return; // 3 sec throttle
                      lastSaveRef.current = now;

                      const el = e.currentTarget;
                      const t = Number(el.currentTime || 0);

                      setLessonWatchedSec(courseId, selectedLessonId, t);

                      const pct = calcCoursePercent({ courseId, lessons, fallbackDurationSec: 300 });
                      setCoursePercent(pct);
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-white/70">
                  Энэ хичээлд видео холбоогүй байна.
                </div>
              )}
            </div>
          </div>

          {/* ✅ tabs */}
          <div className="mt-6 flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setTab("list")}
                className={[
                  "rounded-full px-6 py-2 text-sm font-extrabold tracking-wide transition",
                  "border border-amber-300/40",
                  "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
                  tab === "list"
                    ? "bg-amber-400/15 text-yellow-300"
                    : "bg-black/20 text-yellow-200/80 hover:bg-amber-400/10",
                ].join(" ")}
                style={{ borderStyle: "dashed" }}
              >
                ХИЧЭЭЛИЙН ЖАГСААЛТ
              </button>

              <button
                type="button"
                onClick={() => setTab("desc")}
                className={[
                  "rounded-full px-6 py-2 text-sm font-extrabold tracking-wide transition",
                  "border border-amber-300/40",
                  "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
                  tab === "desc"
                    ? "bg-amber-400/15 text-yellow-300"
                    : "bg-black/20 text-yellow-200/80 hover:bg-amber-400/10",
                ].join(" ")}
                style={{ borderStyle: "dashed" }}
              >
                ХИЧЭЭЛИЙН ТАЙЛБАР
              </button>
            </div>
          </div>

          {/* ✅ panel */}
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-amber-300/20 bg-black/15 p-4">
              {tab === "desc" ? (
                <div className="min-h-[260px] rounded-xl border border-white/10 bg-black/25 p-5">
                  <div className="text-sm font-bold text-yellow-300">
                    {selectedLesson ? (
                      <>
                        {lessons.findIndex((x) => x.id === selectedLesson.id) + 1}.{" "}
                        <span className="text-white/90">{selectedLesson.title}</span>
                      </>
                    ) : (
                      <span className="text-white/70">Хичээл сонгоогүй байна.</span>
                    )}
                  </div>

                  <div className="mt-4 text-sm leading-7 text-white/75">
                    {selectedLesson?.description?.trim()
                      ? selectedLesson.description
                      : "Тайлбар оруулаагүй байна."}
                  </div>
                </div>
              ) : (
                <div className="max-h-[440px] overflow-auto pr-1">
                  {lessons.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-white/70">
                      Одоогоор хичээл алга.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {lessons.map((l, idx) => {
                        const active = l.id === selectedLessonId;
                        const t = fmtDuration(l.durationSec);
                        const completed = isLessonCompleted({
                          courseId,
                          lessonId: l.id,
                          durationSec: l.durationSec,
                        });

                        return (
                          <button
                            key={l.id}
                            onClick={() => setSelectedLessonId(l.id)}
                            className={[
                              "group w-full rounded-2xl border px-4 py-3 text-left transition",
                              "focus:outline-none focus:ring-2 focus:ring-white/10",
                              active
                                ? "border-white/25 bg-white/10"
                                : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/15",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[15px] font-extrabold text-white/90 group-hover:text-white">
                                  {idx + 1}. {l.title}
                                </div>

                                <div className="mt-1 text-xs text-white/55">
                                  {active ? "Одоо үзэж байна" : completed ? "Үзсэн" : "Дарж сонгоно"}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {completed ? (
                                  <div className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                                    ✅ Үзсэн
                                  </div>
                                ) : null}

                                {t ? (
                                  <div className="shrink-0 rounded-full border border-white/12 bg-black/25 px-3 py-1 text-[11px] font-semibold text-white/70">
                                    {t}
                                  </div>
                                ) : null}
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
            <div className="fixed right-4 top-4 z-[60] rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-sm text-white backdrop-blur">
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // =========================================================
  // ✅ NOT PURCHASED VIEW
  // =========================================================
  return (
    <div className="mx-auto max-w-6xl px-6 pt-10 pb-10 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.shortDescription ? (
          <p className="text-white/70">{course.shortDescription}</p>
        ) : course.description ? (
          <p className="text-white/70">{course.description}</p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          {course.thumbnailUrl ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
              <div className="relative aspect-[16/9] w-full">
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
                />
                <div className="absolute inset-0 bg-black/45" />
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="relative z-10 h-full w-full object-cover"
                />
              </div>
            </div>
          ) : null}

          {/* PRICE CARD */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200">
                  ✓
                </span>
                <div className="text-base font-extrabold text-white">{durationLabel}</div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold">
                  {money(Number(course.price ?? 0))}₮ <span className="text-xs text-white/55">/ сар</span>
                </div>
                {course.oldPrice ? (
                  <div className="text-xs text-white/45 line-through">
                    {money(Number(course.oldPrice))}₮
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={mockBuying}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
              >
                {mockBuying ? "Идэвхжүүлж байна..." : "Худалдан авах"}
              </button>

              {!user ? (
                <div className="mt-3 text-xs text-white/55">
                  Видео үзэхийн тулд нэвтрэх шаардлагатай.{" "}
                  <button
                    className="underline underline-offset-4 hover:text-white"
                    onClick={() =>
                      router.push(`/login?callbackUrl=${encodeURIComponent(`/course/${courseId}`)}`)
                    }
                  >
                    Нэвтрэх
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <InfoBlock
            title="Энэ сургалт хэнд тохирох вэ?"
            items={whoForItems.length ? whoForItems : whoForFallback}
          />
          <InfoBlock
            title="Юу сурах вэ?"
            items={learnItems.length ? learnItems : learnFallback}
          />
        </aside>

        {/* RIGHT */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">Үзэх</div>
              <div className="text-xs text-white/50">
                {lessons.length ? `${lessons.length} хичээл` : "0 хичээл"}
              </div>
            </div>

            {!user ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-white/70">
                🔐 Видео үзэхийн тулд эхлээд нэвтрэнэ.
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-white/70">
                🔒 Видео үзэх боломжгүй байна. Худалдаж авсны дараа нээгдэнэ.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">Хичээлүүд</div>
              <div className="text-xs text-white/50">Preview</div>
            </div>

            {lessons.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-white/70">
                Одоогоор lesson алга.
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                {lessons.map((l, idx) => (
                  <div
                    key={l.id}
                    className="w-full rounded-2xl border border-white/10 bg-black/10 px-5 py-4 text-left"
                  >
                    <div className="text-[15px] font-extrabold text-white/90">
                      {idx + 1}. {l.title}
                    </div>
                    <div className="mt-1 text-xs text-white/55">Худалдаж авсны дараа үзнэ</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast ? (
        <div className="fixed right-4 top-4 z-[60] rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-sm text-white backdrop-blur">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
