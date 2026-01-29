"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import { calcCoursePercent } from "@/lib/progress";

type Course = {
  id: string;
  title?: string;
  price?: number;
  oldPrice?: number;
  category?: string;
  year?: string;
  thumbnailUrl?: string;
  durationLabel?: string;
  shortDescription?: string;
};

type LessonMini = {
  id: string;
  durationSec?: number;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export default function MyContentPage() {
  const router = useRouter();
  const { user, loading, purchasedCourseIds } = useAuth();

  const ids = useMemo(
    () => (purchasedCourseIds ?? []).filter(Boolean),
    [purchasedCourseIds]
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(false);

  // ✅ Progress
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [progressLoading, setProgressLoading] = useState(false);

  // ✅ Missing courses (Firestore дээр course doc байхгүй)
  const [missingIds, setMissingIds] = useState<string[]>([]);

  const avgProgress = useMemo(() => {
    if (!courses.length) return 0;
    const vals = courses.map((c) => Number(progressMap[c.id] ?? 0));
    if (!vals.length) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return clamp(Math.round(sum / vals.length));
  }, [courses, progressMap]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent("/my-content")}`);
    }
  }, [loading, user, router]);

  // ✅ Load purchased courses (original logic хэвээр)
  useEffect(() => {
    if (loading || !user) return;

    const run = async () => {
      setFetching(true);
      try {
        if (ids.length === 0) {
          setCourses([]);
          setProgressMap({});
          setMissingIds([]);
          return;
        }

        const groups = chunk(ids, 10);
        const results: Course[] = [];

        for (const g of groups) {
          const qy = query(
            collection(db, "courses"),
            where(documentId(), "in", g)
          );
          const snap = await getDocs(qy);
          snap.forEach((d) => results.push({ id: d.id, ...(d.data() as any) }));
        }

        // ✅ missing check
        const got = new Set(results.map((r) => r.id));
        const miss = ids.filter((id) => !got.has(id));
        setMissingIds(miss);

        // ✅ order by purchased order
        const orderMap = new Map(ids.map((id, idx) => [id, idx]));
        results.sort(
          (a, b) =>
            (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999)
        );

        setCourses(results);
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, user, ids]);

  // ✅ Load progress per course
  useEffect(() => {
    if (!user) return;
    if (!courses.length) {
      setProgressMap({});
      return;
    }

    const run = async () => {
      setProgressLoading(true);
      try {
        const map: Record<string, number> = {};

        for (const c of courses) {
          try {
            const lessonsQ = query(
              collection(db, "courses", c.id, "lessons"),
              orderBy("order", "asc")
            );
            const snap = await getDocs(lessonsQ);

            const lessonList: LessonMini[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return { id: d.id, durationSec: data?.durationSec };
            });

            const pct = calcCoursePercent({
              courseId: c.id,
              lessons: lessonList,
              fallbackDurationSec: 300, // durationSec байхгүй бол 5 минут
            });

            map[c.id] = clamp(pct);
          } catch (e) {
            console.error("progress load error for course:", c.id, e);
            map[c.id] = 0;
          }
        }

        setProgressMap(map);
      } finally {
        setProgressLoading(false);
      }
    };

    run();
  }, [user, courses]);

  if (loading || !user) return null;

  const purchasedCount = ids.length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 min-h-[90vh] text-white">
      {/* ===================================================== */}
      {/* ✅ SIMPLE DASHBOARD (Skool шиг ойлгомжтой)             */}
      {/* ===================================================== */}
      <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-6 shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-white/55">Миний dashboard</div>
            <div className="mt-1 text-2xl font-extrabold">
              Сайн уу 👋
            </div>
            <div className="mt-1 text-sm text-white/60">
              Танд <span className="font-semibold text-white/85">{purchasedCount}</span> багц нээгдсэн байна.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/contents")}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-extrabold text-white/85 hover:bg-white/10 transition"
            >
              Нэмэлт багц үзэх →
            </button>
            <button
              onClick={() => {
                // хамгийн эхний курс руу “үргэлжлүүлэх” (simple)
                const first = ids?.[0];
                if (first) router.push(`/course/${first}`);
                else router.push("/contents");
              }}
              className="rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-6 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(251,146,60,0.85)] hover:shadow-[0_0_36px_rgba(251,146,60,1)] transition"
            >
              Үргэлжлүүлэх →
            </button>
          </div>
        </div>

        {/* ✅ Overall progress */}
        {purchasedCount > 0 ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">Нийт ахиц</div>
              <div className="text-sm font-extrabold text-white">
                {progressLoading ? "..." : `${avgProgress}%`}
              </div>
            </div>

            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                style={{ width: `${progressLoading ? 0 : avgProgress}%` }}
              />
            </div>

            <div className="mt-2 text-xs text-white/55">
              {progressLoading
                ? "Ахиц тооцоолж байна..."
                : avgProgress < 20
                ? "Эхлэл — өдөр бүр 10–15 минут үзвэл хурдан ахина."
                : avgProgress < 70
                ? "Сайн явж байна — тогтмол үргэлжлүүл."
                : avgProgress < 100
                ? "Бараг дууслаа — сүүлийн хэсгээ хийчих!"
                : "Бүгдийг дуусгасан ✅"}
            </div>
          </div>
        ) : null}
      </div>

      {/* ===================================================== */}
      {/* ✅ PURCHASED COURSES                                  */}
      {/* ===================================================== */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 backdrop-blur p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Миний авсан сургалтууд</div>
            <div className="mt-1 text-sm text-white/55">
              Карт дээрх <span className="text-white/80 font-semibold">%</span> нь таны үзсэн ахиц.
            </div>
          </div>

          <button
            onClick={() => router.push("/contents")}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-extrabold text-white/80 hover:bg-white/10 transition"
          >
            Бүх багц үзэх →
          </button>
        </div>

        {fetching ? (
          <div className="mt-6 text-white/70">Уншиж байна...</div>
        ) : ids.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Та одоогоор худалдаж авсан сургалтгүй байна.
          </div>
        ) : (
          <>
            {/* ✅ Missing courses warning (doc байхгүй) */}
            {missingIds.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                ⚠️ {missingIds.length} курсийн мэдээлэл Firestore дээр олдсонгүй (устсан эсвэл нэр өөрчлөгдсөн байж магадгүй).
                <div className="mt-2 text-xs text-amber-100/80 break-all">
                  {missingIds.join(", ")}
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const pct = Number(progressMap[course.id] ?? 0);

                return (
                  <div key={course.id} className="relative">
                    {/* ✅ Progress overlay (CourseCard-г эвдэхгүй) */}
                    <div className="pointer-events-none absolute right-3 top-3 z-30">
  {/* ✅ Pretty badge */}
  <div
    className={[
      "rounded-full px-3 py-1 text-xs font-extrabold tracking-wide backdrop-blur",
      "border",
      pct === 0
        ? "border-white/10 bg-white/10 text-white/70 animate-pulse"
        : pct < 100
        ? "border-orange-300/30 bg-gradient-to-r from-orange-400 to-amber-500 text-black shadow-[0_0_18px_rgba(255,165,0,0.55)]"
        : "border-emerald-300/30 bg-gradient-to-r from-emerald-400 to-green-500 text-black shadow-[0_0_18px_rgba(0,255,150,0.55)]",
    ].join(" ")}
  >
    {pct === 0 ? "Эхлээгүй • 0%" : pct === 100 ? "Дууссан • 100%" : `${pct}%`}
  </div>

  {/* ✅ Bar */}
  <div className="mt-2 h-2 w-[92px] overflow-hidden rounded-full bg-white/10">
    <div
      className={[
        "h-full rounded-full transition-all",
        pct === 0
          ? "bg-white/20"
          : pct < 100
          ? "bg-gradient-to-r from-orange-400 to-amber-500"
          : "bg-gradient-to-r from-emerald-400 to-green-500",
      ].join(" ")}
      style={{ width: `${progressLoading ? 0 : pct}%` }}
    />
  </div>
</div>
  <CourseCard
                      course={course as any}
                      isPurchased={true}
                      href={`/course/${course.id}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* ✅ Simple next steps (Skool шиг ойлгомжтой) */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm font-extrabold text-white/90">
                Дараагийн алхам
              </div>
              <div className="mt-2 text-sm text-white/60">
                Илүү хурдан ахихыг хүсвэл дараах багцуудыг үзээрэй.
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { t: "AI Video (Pro)", d: "Видео хийх чадвараа дараагийн түвшинд." },
                  { t: "Automation + ManyChat", d: "Автомат борлуулалтын систем." },
                  { t: "Prompt Library", d: "Бэлэн prompt-ууд, хурдан хэрэглээ." },
                ].map((x) => (
                  <button
                    key={x.t}
                    onClick={() => router.push("/contents")}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
                  >
                    <div className="text-sm font-extrabold text-white/90">{x.t}</div>
                    <div className="mt-1 text-xs text-white/60">{x.d}</div>
                    <div className="mt-3 inline-flex rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-[11px] font-extrabold text-orange-200">
                      Нээх →
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => router.push("/contents")}
                  className="rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-6 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(251,146,60,0.85)] hover:shadow-[0_0_36px_rgba(251,146,60,1)] transition"
                >
                  Нэмэлт багц авах →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
