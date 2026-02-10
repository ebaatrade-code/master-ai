"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import QPayCheckoutModal from "@/components/QPayCheckoutModal";

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
    downloadUrl?: string;
    contentType?: string;
    size?: number;
    uploadedAt?: any;
    originalName?: string;
  };
};

type ProgressDoc = {
  byLessonSec: Record<string, number>;
  lastLessonId: string;
  updatedAt: any;
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

function calcCoursePercentFromMap(params: {
  lessons: Array<{ id: string; durationSec?: number }>;
  byLessonSec: Record<string, number>;
  fallbackDurationSec?: number;
}) {
  const fallback = Math.max(60, Number(params.fallbackDurationSec ?? 300));
  let total = 0;
  let done = 0;

  for (const l of params.lessons) {
    const dur = Number(l.durationSec);
    const d = Number.isFinite(dur) && dur > 0 ? dur : fallback;
    total += d;

    const watched = Number(params.byLessonSec?.[l.id] ?? 0);
    done += Math.min(watched, d);
  }

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return Math.max(0, Math.min(100, percent));
}

function isLessonCompletedFromMap(params: {
  lessonId: string;
  byLessonSec: Record<string, number>;
  durationSec?: number;
}) {
  const watched = Number(params.byLessonSec?.[params.lessonId] ?? 0);
  const dur = Number(params.durationSec);
  if (Number.isFinite(dur) && dur > 0) return watched >= dur * 0.9;
  return watched >= 180;
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-none border-0 bg-transparent p-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>

      <div className="mt-3 h-px w-full bg-white/10" />

      <ul className="mt-4 space-y-2 text-sm text-white/70">
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

function MobileInfoBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-none border-0 bg-transparent p-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-black">{title}</div>
      </div>

      <div className="mt-3 h-px w-full bg-black/10" />

      <ul className="mt-4 space-y-2 text-sm text-black/75">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[2px] text-black/35">•</span>
            <span>{t}</span>
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
  const [coursePercent, setCoursePercent] = useState(0);
  const [byLessonSec, setByLessonSec] = useState<Record<string, number>>({});
  const lastSaveRef = useRef(0);

  const progressDocRef = useMemo(() => {
    if (!user?.uid) return null;
    if (!courseId) return null;
    return doc(db, "users", user.uid, "courseProgress", courseId);
  }, [user?.uid, courseId]);

  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // ✅ PAYMENT MODAL (ганц UI)
  const [buyOpen, setBuyOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [urls, setUrls] = useState<Deeplink[]>([]);

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
      setPayStatus("Үнэ буруу байна. Admin дээр course price-аа шалгаарай.");
      return;
    }

    try {
      setPayBusy(true);
      setPayStatus("Төлбөр үүсгэж байна…");
      setOrderId(null);
      setQrImage(null);
      setQrText(null);
      setUrls([]);

      const idToken = await user!.getIdToken();

      const res = await fetch("/api/qpay/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          amount,
          title: course?.title ?? "Course",
        }),
      });

      const data: any = await res.json().catch(() => null);

      if (!res.ok) {
        setPayStatus(data?.message || data?.error || data?.detail?.error || "Invoice үүсгэхэд алдаа гарлаа.");
        return;
      }

      setOrderId(String(data?.orderId || ""));
      setQrImage(data?.qrImage ? String(data.qrImage) : null);
      setQrText(data?.qrText ? String(data.qrText) : null);
      setUrls(Array.isArray(data?.urls) ? (data.urls as Deeplink[]) : []);
      setPayStatus("QR эсвэл банкны апп (deeplink)-аар төлөөд “Төлбөр шалгах” дарна уу.");
    } catch (e: any) {
      setPayStatus(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleCheckPayment() {
    if (!user || !orderId) {
      setPayStatus("Order олдсонгүй. Дахин үүсгээд оролдоорой.");
      return;
    }

    try {
      setPayBusy(true);
      setPayStatus("Төлбөр шалгаж байна…");
      const idToken = await user.getIdToken();

      const res = await fetch("/api/qpay/checkout/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const data: any = await res.json().catch(() => null);

      if (!res.ok) {
        setPayStatus(data?.message || data?.error || "Төлбөр шалгахад алдаа гарлаа.");
        return;
      }

      if (data?.status === "PAID") {
        setPayStatus("Төлбөр баталгаажлаа ✅ Курс нээгдлээ!");
        setToast("✅ Төлбөр баталгаажлаа. Сургалт нээгдлээ!");
       setBuyOpen(false);
        router.refresh();
      } else {
        setPayStatus("Одоогоор төлбөр баталгаажаагүй байна. Дахин шалгана уу.");
      }
    } catch (e: any) {
      setPayStatus(e?.message || "Шалгах үед алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setPayBusy(false);
    }
  }

  const saveProgress = async (lessonId: string, nextSec: number) => {
    if (!progressDocRef) return;

    setByLessonSec((p) => ({ ...p, [lessonId]: nextSec }));

    try {
      await updateDoc(progressDocRef, {
        [`byLessonSec.${lessonId}`]: nextSec,
        lastLessonId: lessonId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        await setDoc(
          progressDocRef,
          {
            byLessonSec: { [lessonId]: nextSec },
            lastLessonId: lessonId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e2) {
        console.error("progress write error:", err, e2);
      }
    }
  };

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

        const lessonsQ = query(collection(db, "courses", courseId, "lessons"), orderBy("order", "asc"));
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

  useEffect(() => {
    const run = async () => {
      if (!isPurchased) {
        setExpiresAtMs(null);
        setIsExpired(false);
        return;
      }
      if (!user?.uid) return;
      if (!courseId) return;

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const data = userSnap.exists() ? (userSnap.data() as any) : null;

        const p = data?.purchases?.[courseId];
        const exp = p?.expiresAt as Timestamp | undefined;

        const ms = exp?.toMillis?.() ?? null;
        setExpiresAtMs(ms);

        if (ms && Date.now() > ms) setIsExpired(true);
        else setIsExpired(false);
      } catch (e) {
        console.error("load purchase expiry error:", e);
        setExpiresAtMs(null);
        setIsExpired(false);
      }
    };

    run();
  }, [isPurchased, user?.uid, courseId]);

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
    const run = async () => {
      if (!isPurchased) return;
      if (isExpired) return;
      if (!user?.uid) return;
      if (!progressDocRef) return;

      try {
        const snap = await getDoc(progressDocRef);
        if (!snap.exists()) {
          const init: ProgressDoc = {
            byLessonSec: {},
            lastLessonId: "",
            updatedAt: serverTimestamp(),
          } as any;
          await setDoc(progressDocRef, init, { merge: true });
          setByLessonSec({});
          return;
        }

        const data = snap.data() as any;
        const raw = (data?.byLessonSec ?? {}) as Record<string, any>;

        const fixed: Record<string, number> = {};
        for (const k of Object.keys(raw)) {
          const v = Number(raw[k] ?? 0);
          fixed[k] = Number.isFinite(v) ? v : 0;
        }
        setByLessonSec(fixed);
      } catch (e) {
        console.error("load progress error:", e);
      }
    };

    run();
  }, [isPurchased, isExpired, user?.uid, progressDocRef]);

  useEffect(() => {
    const run = async () => {
      setVideoSrc(null);

      if (!isPurchased) return;
      if (isExpired) return;
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
  }, [selectedLessonId, lessons, isPurchased, isExpired]);

  useEffect(() => {
    if (!isPurchased) return;
    if (isExpired) return;
    if (!lessons.length) return;

    const pct = calcCoursePercentFromMap({
      lessons,
      byLessonSec,
      fallbackDurationSec: 300,
    });
    setCoursePercent(pct);
  }, [isPurchased, isExpired, lessons, byLessonSec]);

  if (fetching) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-white/70">Уншиж байна...</div>;
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

  // =========================================================
  // ✅ PURCHASED VIEW (ХЭВЭЭР)
  // =========================================================
  if (isPurchased) {
    if (isExpired) {
      return (
        <div className="lesson-viewer min-h-[calc(100vh-80px)]">
          <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-16">
            <div className="flex justify-center">
              <div className="w-full max-w-3xl px-6 py-2 text-center">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-yellow-400">
                  {course.title}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="w-full max-w-3xl rounded-2xl border border-red-400/25 bg-black/20 p-6">
                <div className="text-lg font-extrabold text-red-300">⛔ Сургалтын хугацаа дууссан байна</div>

                <div className="mt-2 text-sm text-white/70">
                  Хугацаа: <span className="text-white/90 font-semibold">{durationLabel}</span>
                </div>

                {expiresAtMs ? (
                  <div className="mt-1 text-sm text-white/60">
                    Дууссан огноо: <span className="text-white/80">{formatExpiresText(expiresAtMs)}</span>
                  </div>
                ) : null}

                <div className="mt-4 text-sm text-white/65">
                  Та дахин идэвхжүүлэх бол “Худалдаж авах” хэсгээс шинэ хугацаатайгаар авна.
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => router.push(`/course/${courseId}`)}
                    className="rounded-full px-6 py-3 text-sm font-extrabold tracking-wide border border-white/12 bg-white/5 hover:bg-white/10"
                  >
                    Буцах →
                  </button>
                </div>
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

    return (
      <div className="lesson-viewer min-h-[calc(100vh-80px)]">
        <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-16">
          <div className="flex justify-center">
            <div className="w-full max-w-3xl px-6 py-2 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-wide text-yellow-400">
                {course.title}
              </div>
            </div>
          </div>

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

          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-amber-300/25 bg-black/20 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.40)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">Видео үзэх</div>

                <div className="text-xs flex items-center gap-2">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                    Хугацаа: {durationLabel}
                  </span>

                  {expiresAtMs ? (
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70">
                      Дуусах: {formatExpiresText(expiresAtMs)}
                    </span>
                  ) : null}
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
                      const pct = calcCoursePercentFromMap({
                        lessons,
                        byLessonSec,
                        fallbackDurationSec: 300,
                      });
                      setCoursePercent(pct);
                    }}
                    onTimeUpdate={async (e) => {
                      if (!selectedLessonId) return;
                      if (!progressDocRef) return;

                      const now = Date.now();
                      if (now - lastSaveRef.current < 3000) return;
                      lastSaveRef.current = now;

                      const t = Math.floor(Number(e.currentTarget.currentTime || 0));
                      const prev = Number(byLessonSec?.[selectedLessonId] ?? 0);
                      const next = Math.max(prev, t);

                      await saveProgress(selectedLessonId, next);
                    }}
                    onEnded={async (e) => {
                      if (!selectedLessonId) return;
                      if (!progressDocRef) return;

                      const dur = Math.floor(Number(e.currentTarget.duration || 0));
                      if (!dur || !Number.isFinite(dur)) return;

                      const prev = Number(byLessonSec?.[selectedLessonId] ?? 0);
                      const next = Math.max(prev, dur);

                      lastSaveRef.current = Date.now();
                      await saveProgress(selectedLessonId, next);
                    }}
                    onPause={async (e) => {
                      if (!selectedLessonId) return;
                      if (!progressDocRef) return;

                      const t = Math.floor(Number(e.currentTarget.currentTime || 0));
                      const prev = Number(byLessonSec?.[selectedLessonId] ?? 0);
                      const next = Math.max(prev, t);

                      if (next <= prev) return;
                      lastSaveRef.current = Date.now();
                      await saveProgress(selectedLessonId, next);
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
                    {selectedLesson?.description?.trim() ? selectedLesson.description : "Тайлбар оруулаагүй байна."}
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
                        const completed = isLessonCompletedFromMap({
                          lessonId: l.id,
                          durationSec: l.durationSec,
                          byLessonSec,
                        });

                        return (
                          <button
                            key={l.id}
                            onClick={() => setSelectedLessonId(l.id)}
                            className={[
                              "group w-full rounded-2xl border px-4 py-3 text-left transition",
                              "focus:outline-none focus:ring-2 focus:ring-white/10",
                              active
                                ? "border-2 border-emerald-300/80 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.20),0_0_22px_rgba(52,211,153,0.35),0_18px_60px_rgba(0,0,0,0.35)]"
                                : "border border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/15",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[16px] font-black text-white tracking-wide">
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
  // ✅ BUY -> Course дээрээс ШУУД “ганц” төлбөрийн modal
  // =========================================================
  return (
    <>
      {/* MOBILE */}
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
              <div className="text-xs font-extrabold tracking-wide text-black/45">БҮЛЭГ 1</div>
            </div>

            <div className="mt-3 min-w-0">
              <div className="text-xl font-extrabold text-black leading-snug">{course.title}</div>

              <div className="mt-2 text-sm leading-6 text-black/70">
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
                    <div className="mt-0.5 text-sm font-bold line-through text-red-500">
                      {money(Number(course.oldPrice))}₮
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBuyOpen(true);
                  createCheckoutInvoice();
                }}
                className="
                  mt-3 w-full rounded-2xl
                  px-5 py-3
                  text-[13px] font-extrabold uppercase tracking-wide
                  text-white
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
                  npTab === "content" ? "bg-black/5 text-black border border-black/10" : "text-black/55 hover:text-black",
                ].join(" ")}
              >
                Хичээлийн агуулга
              </button>

              <button
                type="button"
                onClick={() => setNpTab("details")}
                className={[
                  "h-9 rounded-xl text-center text-[11px] font-extrabold tracking-wide transition",
                  npTab === "details" ? "bg-black/5 text-black border border-black/10" : "text-black/55 hover:text-black",
                ].join(" ")}
              >
                Дэлгэрэнгүй мэдээлэл
              </button>
            </div>

            <div className="mt-4">
              {npTab === "content" ? (
                <div className="space-y-3">
                  {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-6 text-black/70 shadow-sm">
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
                            {course.thumbnailUrl ? (
                              <img
                                src={course.thumbnailUrl}
                                alt=""
                                aria-hidden="true"
                                className="h-full w-full object-cover opacity-95"
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-black text-black tracking-wide">
                              {idx + 1}. {l.title}
                            </div>
                            <div className="mt-1 line-clamp-1 text-xs text-black/60">
                              {l.description?.trim() ? l.description : "Худалдаж авсны дараа энэ хичээл нээгдэнэ."}
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-xs font-bold text-black/70">{t ? t : "—"}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-6 shadow-sm">
                  <MobileInfoBlock
                    title="Энэ сургалт хэнд тохирох вэ?"
                    items={whoForItems.length ? whoForItems : whoForFallback}
                  />
                  <MobileInfoBlock title="Юу сурах вэ?" items={learnItems.length ? learnItems : learnFallback} />
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

      {/* DESKTOP */}
      <div
        className="hidden lg:block min-h-[calc(100vh-80px)] text-white overflow-x-hidden"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 0%, rgba(120,120,120,0.10), rgba(0,0,0,0.95)), radial-gradient(circle at 10% 20%, rgba(255,200,0,0.05), transparent 45%), radial-gradient(circle at 90% 80%, rgba(0,255,170,0.06), transparent 55%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-12">
          <div className="hidden lg:block">
            {course.thumbnailUrl ? (
              <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_22px_90px_rgba(0,0,0,0.55)]">
                <div className="relative aspect-video w-full">
                  <img
                    src={course.thumbnailUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-3xl scale-125 opacity-45"
                  />
                  <div className="absolute inset-0 bg-black/55" />
                  <img src={course.thumbnailUrl} alt={course.title} className="relative z-10 h-full w-full object-contain" />
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section className="px-1">
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <div className="mt-[10px] h-5 w-[2px] rounded-full bg-white/20" />
                    <div className="text-xs font-extrabold tracking-wide text-white/45">БҮЛЭГ 1</div>
                  </div>

                  <div className="mt-2 flex gap-3">
                    <div className="mt-[8px] h-7 w-[2px] rounded-full bg-white/25" />
                    <div className="min-w-0">
                      <div className="truncate text-xl font-extrabold text-white/90">{course.title}</div>
                      <div className="mt-2 text-sm leading-6 text-white/60">
                        {course.shortDescription?.trim()
                          ? course.shortDescription
                          : course.description?.trim()
                          ? course.description
                          : "Энэ сургалтаар системтэйгээр үзэж, давтаж хийж сурна."}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-px w-full bg-white/10" />
                </div>

                <div className="space-y-4">
                  {lessons.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/70">
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
                            "rounded-3xl border border-white/10",
                            "bg-black/20 px-6 py-6",
                            "min-h-[120px]",
                            "hover:bg-black/30 transition",
                          ].join(" ")}
                        >
                          <div className="h-16 w-28 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                            {course.thumbnailUrl ? (
                              <img src={course.thumbnailUrl} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-90" />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[16px] font-black text-white tracking-wide drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]">
                              {idx + 1}. {l.title}
                            </div>
                            <div className="mt-2 line-clamp-2 text-xs text-white/55">
                              {l.description?.trim() ? l.description : "Худалдаж авсны дараа энэ хичээл нээгдэнэ."}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-xs font-extrabold text-white/70">{t ? t : "—"}</div>
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
                      border-cyan-300/70
                      bg-black/40
                      p-6
                      shadow-[
                        inset_0_0_12px_rgba(34,211,238,0.35),
                        0_0_12px_rgba(34,211,238,0.55),
                        0_0_32px_rgba(34,211,238,0.45),
                        0_0_72px_rgba(34,211,238,0.25)
                      ]
                      transition-all
                      duration-300
                      hover:border-cyan-200
                      hover:shadow-[
                        inset_0_0_18px_rgba(34,211,238,0.55),
                        0_0_18px_rgba(34,211,238,0.8),
                        0_0_48px_rgba(34,211,238,0.6),
                        0_0_96px_rgba(34,211,238,0.35)
                      ]
                    "
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-lg font-extrabold text-white">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white">
                          <span className="h-2.5 w-2.5 rounded-full bg-white" />
                        </span>
                        <span className="tracking-wide">{durationLabel}</span>
                      </div>

                      <div className="text-right">
                        <div
                          className="
                            text-2xl font-extrabold tracking-tight
                            text-white
                            drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]
                          "
                        >
                          {money(Number(course.price ?? 0))}₮
                        </div>

                        {course.oldPrice && (
                          <div
                            className="
                              mt-0.5 text-sm font-extrabold line-through
                              text-red-500
                              drop-shadow-[0_0_10px_rgba(239,68,68,1)]
                            "
                          >
                            {money(Number(course.oldPrice))}₮
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBuyOpen(true);
                        createCheckoutInvoice();
                      }}
                      className="
                        w-full rounded-full
                        px-6 py-4
                        text-sm font-extrabold uppercase tracking-wide
                        text-white
                        bg-gradient-to-r from-cyan-400 to-blue-500
                        shadow-[0_0_35px_rgba(0,180,255,0.75)]
                        hover:from-cyan-300 hover:to-blue-400
                        hover:shadow-[0_0_45px_rgba(0,180,255,0.95)]
                        transition-all duration-300
                      "
                    >
                      ХУДАЛДАЖ АВАХ →
                    </button>
                  </div>
                </div>

                <InfoBlock title="Энэ сургалт хэнд тохирох вэ?" items={whoForItems.length ? whoForItems : whoForFallback} />
                <InfoBlock title="Юу сурах вэ?" items={learnItems.length ? learnItems : learnFallback} />
              </aside>
            </div>
          </div>

          {toast ? (
            <div className="fixed right-4 top-4 z-[60] rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-sm text-white backdrop-blur">
              {toast}
            </div>
          ) : null}
        </div>
      </div>

     {/* ✅ ГАНЦ ТӨЛБӨРИЙН UI MODAL */}
<QPayCheckoutModal
  open={buyOpen}
  onClose={() => setBuyOpen(false)}
  courseId={courseId}
  title={course.title}
  amount={amount}
/>
  </>
  );
}