"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import {
  calcCoursePercentFromProgress,
  getCourseProgressFS,
} from "@/lib/progress";

type Course = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  authorName?: string;
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

// ✅ Timestamp/string/date -> ms helper
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

/** ✅ Wide premium card */
function PurchasedWideCard({
  course,
  pct,
  onContinue,
}: {
  course: Course;
  pct: number;
  onContinue: () => void;
}) {
  return (
    <div className="premium-card p-5 rounded-[26px] md:rounded-[22px]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        {/* Left thumbnail */}
        <div className="relative w-full lg:w-[420px]">
          <div className="relative overflow-hidden rounded-[22px] border border-orange-300/25 bg-black/30 shadow-[0_0_0_1px_rgba(255,138,0,0.10),0_18px_60px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute inset-0 ring-1 ring-[rgba(255,138,0,0.22)]" />
            <div className="pointer-events-none absolute -inset-6 bg-[rgba(255,138,0,0.10)] blur-[40px]" />
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={
                  course.thumbnailUrl ||
                  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600&auto=format&fit=crop"
                }
                alt={course.title || "Course"}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.60),transparent_65%)]" />
            </div>
          </div>
        </div>

        {/* Right info */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="text-sm font-extrabold tracking-wide text-black md:text-black">
              КУРС
            </div>

            <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black md:border-black/10 md:bg-black/[0.03] md:text-black">
              • •
            </div>
          </div>

          <div className="mt-3 text-2xl font-extrabold leading-tight text-black md:text-black">
            {course.title || "Таны курс"}
          </div>

          <div className="mt-4">
            <div className="text-sm text-black md:text-black">
              Прогресс:{" "}
              <span className="font-extrabold text-black md:text-black">
                {pct}%
              </span>
            </div>

            {/* ✅ FIX: Desktop дээр ч саарал track + улбар шар fill (цагаан болохгүй) */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-300 ring-1 ring-black/10 shadow-inner">
              <div
                className="h-full rounded-full transition-all bg-orange-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-black md:text-black">
            Хичээл заасан:{" "}
            <span className="font-semibold text-black md:text-black">
              {course.authorName || "ebacreator"}
            </span>
          </div>

          <div className="mt-6 flex md:justify-end">
            {/* ✅ NEW: Gradient stroke wrapper (blue → purple) */}
            <div className="rounded-full bg-gradient-to-r from-orange-400/40 via-orange-300/30 to-orange-400/40 p-[1.5px] md:rounded-xl">
              <button
                onClick={onContinue}
                className="
                  premium-btn
                  px-10 py-3 text-sm
                  rounded-full
                  md:rounded-xl
                "
              >
                ҮРГЭЛЖЛҮҮЛЭХ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyContentPage() {
  const router = useRouter();
  const { user, loading, purchasedCourseIds } = useAuth();

  // ✅ AuthProvider-аас ирсэн raw ids
  const rawIds = useMemo(
    () => (purchasedCourseIds ?? []).filter(Boolean),
    [purchasedCourseIds]
  );

  // ✅ Expired-үүдийг хассан ACTIVE ids
  const [ids, setIds] = useState<string[]>([]);
  const [expiryChecked, setExpiryChecked] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(false);

  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [overallPct, setOverallPct] = useState(0);

  const [progressLoading, setProgressLoading] = useState(false);
  const [missingIds, setMissingIds] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user)
      router.replace(
        `/login?callbackUrl=${encodeURIComponent("/my-content")}`
      );
  }, [loading, user, router]);

  // ✅ “Миний сургалтууд”-аас хугацаа дууссан курсийг автоматаар хасна
  useEffect(() => {
    if (loading || !user) return;

    const run = async () => {
      setExpiryChecked(false);

      // rawIds хоосон бол шууд reset
      if (rawIds.length === 0) {
        setIds([]);
        setExpiryChecked(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        const purchases = data?.purchases ?? {};

        const now = Date.now();
        const active: string[] = [];

        for (const courseId of rawIds) {
          const p = purchases?.[courseId] ?? null;
          const expMs = tsToMs(p?.expiresAt);

          // ✅ expMs байгаа бөгөөд хугацаа нь өнгөрсөн бол ACTIVE-д оруулахгүй
          if (expMs && now > expMs) continue;

          active.push(courseId);
        }

        setIds(active);
      } catch {
        // ⚠️ Алдаа гарвал “хасах” биш “үзүүлэх” нь илүү safe
        setIds(rawIds);
      } finally {
        setExpiryChecked(true);
      }
    };

    run();
  }, [loading, user, rawIds]);

  useEffect(() => {
    if (loading || !user) return;
    if (!expiryChecked) return;

    const run = async () => {
      setFetching(true);
      try {
        if (ids.length === 0) {
          setCourses([]);
          setProgressMap({});
          setOverallPct(0);
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

        const got = new Set(results.map((r) => r.id));
        const miss = ids.filter((id) => !got.has(id));
        setMissingIds(miss);

        const orderMap = new Map(ids.map((id, idx) => [id, idx]));
        results.sort(
          (a, b) =>
            (orderMap.get(a.id) ?? 999999) -
            (orderMap.get(b.id) ?? 999999)
        );

        setCourses(results);
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, user, ids, expiryChecked]);

  useEffect(() => {
    if (!user) return;
    if (!courses.length) {
      setProgressMap({});
      setOverallPct(0);
      return;
    }

    const run = async () => {
      setProgressLoading(true);
      try {
        const map: Record<string, number> = {};
        let sumPct = 0;
        let counted = 0;

        for (const c of courses) {
          const lessonsQ = query(
            collection(db, "courses", c.id, "lessons"),
            orderBy("order", "asc")
          );
          const snap = await getDocs(lessonsQ);

          const lessonList: LessonMini[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return { id: d.id, durationSec: data?.durationSec };
          });

          const progress = await getCourseProgressFS(user.uid, c.id);

          const pct = clamp(
            calcCoursePercentFromProgress({
              lessons: lessonList,
              progress,
              fallbackDurationSec: 300,
            })
          );

          map[c.id] = pct;
          sumPct += pct;
          counted += 1;
        }

        setProgressMap(map);

        const ov = counted > 0 ? Math.round(sumPct / counted) : 0;
        setOverallPct(clamp(ov));
      } finally {
        setProgressLoading(false);
      }
    };

    run();
  }, [user, courses]);

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 min-h-[90vh] text-black md:text-black">
      <div className="flex items-center justify-between gap-6">
        <div className="text-3xl font-extrabold tracking-tight text-black md:text-black">
          Миний сургалтууд
        </div>

        <button
          onClick={() => router.push("/contents")}
          className="
            premium-btn
            px-6 py-3 text-sm
            rounded-[20px]
            md:rounded-xl
          "
        >
          Бүх багц үзэх →
        </button>
      </div>

      {ids.length > 0 ? (
        <div className="mt-5 p-5 rounded-[22px] bg-[#F3F4F6] border border-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.10)] md:bg-white/5 md:border-white/10 md:shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-black md:text-black">
              Нийт прогресс
            </div>
            <div className="text-sm font-extrabold text-black md:text-black">
              {progressLoading ? "..." : `${overallPct}%`}
            </div>
          </div>

          {/* ✅ FIX: Desktop дээр ч саарал track + улбар шар fill (цагаан болохгүй) */}
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-300 ring-1 ring-black/10 shadow-inner">
            <div
              className="h-full rounded-full transition-all bg-orange-500"
              style={{ width: `${progressLoading ? 0 : overallPct}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-black md:text-black">
            {progressLoading
              ? "Тооцоолж байна..."
              : overallPct < 20
              ? "Эхлэл — өдөр бүр 10–15 минут үзээд хурдасгаарай."
              : overallPct < 70
              ? "Сайн явж байна — ХИЧЭЭГЭЭРЭЙ."
              : overallPct < 100
              ? "Бараг дууслаа — сүүлийн хэсгээ үз!"
              : "Бүгдийг 100% үзсэн ✅"}
          </div>
        </div>
      ) : null}

      <div className="mt-7">
        {fetching ? (
          <div className="premium-card p-6 text-black md:text-black">
            Уншиж байна...
          </div>
        ) : ids.length === 0 ? (
          <div className="premium-card p-6 text-black md:text-black">
            Та одоогоор худалдаж авсан сургалтгүй байна.
          </div>
        ) : (
          <>
            {missingIds.length > 0 ? (
              <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4 text-sm text-black md:text-black">
                ⚠️ {missingIds.length} курс Firestore дээр олдсонгүй.
                <div className="mt-2 text-xs break-all text-black md:text-black">
                  {missingIds.join(", ")}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {courses.map((course) => (
                <PurchasedWideCard
                  key={course.id}
                  course={course}
                  pct={Number(progressMap[course.id] ?? 0)}
                  onContinue={() => router.push(`/course/${course.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}