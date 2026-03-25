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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Course = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  authorName?: string;
  lessonCount?: number;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function tsToMs(x: any): number | null {
  try {
    if (!x) return null;
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string") { const d = new Date(x); const ms = d.getTime(); return Number.isFinite(ms) ? ms : null; }
    if (typeof x?.toMillis === "function") { const ms = x.toMillis(); return Number.isFinite(ms) ? ms : null; }
    if (typeof x?.toDate === "function") { const d = x.toDate(); const ms = d?.getTime?.(); return Number.isFinite(ms) ? ms : null; }
    return null;
  } catch { return null; }
}

function CourseCard({
  course,
  isNew,
  onContinue,
}: {
  course: Course;
  isNew: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title || "Course"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}

        {/* dark overlay gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* КУРС badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-black tracking-widest text-white">
            КУРС
          </span>
        </div>

        {/* Title overlay on thumbnail */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="text-base font-extrabold leading-snug text-white drop-shadow-sm line-clamp-2">
            {course.title || "Таны курс"}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
        {/* Author + lesson count */}
        <div className="flex items-center gap-2 text-[12px] text-black/45">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{course.authorName || "ebacreator"}</span>

          {course.lessonCount != null && course.lessonCount > 0 && (
            <>
              <span className="text-black/20">·</span>
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{course.lessonCount} хичээл</span>
            </>
          )}
        </div>

        {/* Thin divider */}
        <div className="my-3 h-px w-full bg-black/6" />

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-black/35">
            {isNew ? "Шинэ" : ""}
          </span>
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-orange-600 active:scale-95"
          >
            {isNew ? "Эхлэх" : "Үргэлжлүүлэх"}
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyContentPage() {
  const router = useRouter();
  const { user, loading, purchasedCourseIds } = useAuth();

  const rawIds = useMemo(
    () => (purchasedCourseIds ?? []).filter(Boolean),
    [purchasedCourseIds]
  );

  const [ids, setIds] = useState<string[]>([]);
  const [expiryChecked, setExpiryChecked] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?callbackUrl=${encodeURIComponent("/my-content")}`);
  }, [loading, user, router]);

  // Filter out expired courses
  useEffect(() => {
    if (loading || !user) return;

    const run = async () => {
      setExpiryChecked(false);
      if (rawIds.length === 0) { setIds([]); setExpiryChecked(true); return; }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        const purchases = data?.purchases ?? {};
        const now = Date.now();
        const active: string[] = [];

        for (const courseId of rawIds) {
          const p = purchases?.[courseId] ?? null;
          const expMs = tsToMs(p?.expiresAt);
          if (expMs && now > expMs) continue;
          active.push(courseId);
        }
        setIds(active);
      } catch {
        setIds(rawIds);
      } finally {
        setExpiryChecked(true);
      }
    };

    run();
  }, [loading, user, rawIds]);

  // Fetch course docs
  useEffect(() => {
    if (loading || !user || !expiryChecked) return;

    const run = async () => {
      setFetching(true);
      try {
        if (ids.length === 0) { setCourses([]); return; }

        const groups = chunk(ids, 10);
        const results: Course[] = [];

        for (const g of groups) {
          const qy = query(collection(db, "courses"), where(documentId(), "in", g));
          const snap = await getDocs(qy);
          snap.forEach((d) => results.push({ id: d.id, ...(d.data() as any) }));
        }

        const orderMap = new Map(ids.map((id, idx) => [id, idx]));
        results.sort((a, b) => (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999));

        setCourses(results);

        // Fetch lesson counts in parallel
        const counts = await Promise.all(
          results.map((c) =>
            fetch(`/api/course/lessons?courseId=${encodeURIComponent(c.id)}`)
              .then((r) => r.ok ? r.json() : null)
              .then((d) => ({ id: c.id, count: Array.isArray(d?.lessons) ? d.lessons.length : 0 }))
              .catch(() => ({ id: c.id, count: 0 }))
          )
        );
        const countMap: Record<string, number> = {};
        for (const { id, count } of counts) countMap[id] = count;
        setLessonCounts(countMap);
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, user, ids, expiryChecked]);

  if (loading || !user) return null;

  const allAuthors = [...new Set(courses.map((c) => c.authorName).filter(Boolean))];
  const authorLabel = allAuthors.length === 1 ? allAuthors[0] : "ebacreator";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-black">
              Миний <span className="text-orange-500">сургалтууд</span>
            </h1>
            <p className="mt-1 text-sm text-black/45">Таны бүртгэлтэй сургалтууд</p>
          </div>

          <button
            onClick={() => router.push("/contents")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition-all hover:bg-black/[0.03] hover:shadow-md"
          >
            Бүх багц үзэх
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Stats pills */}
        {ids.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm font-semibold text-black shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <svg className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {ids.length} курс
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm font-semibold text-black shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <svg className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Хичээл заасан: <span className="font-extrabold">{authorLabel}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mt-8">
          {fetching ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[320px] animate-pulse rounded-2xl bg-black/5" />
              ))}
            </div>
          ) : ids.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-black/[0.02] p-10 text-center">
              <div className="mb-3 rounded-full bg-black/5 p-4">
                <svg className="h-8 w-8 text-black/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-black/60">Та одоогоор худалдаж авсан сургалтгүй байна</p>
              <button
                onClick={() => router.push("/contents")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
              >
                Сургалт үзэх
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={{ ...course, lessonCount: lessonCounts[course.id] }}
                  isNew={!lessonCounts[course.id]}
                  onContinue={() => router.push(`/course/${course.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
