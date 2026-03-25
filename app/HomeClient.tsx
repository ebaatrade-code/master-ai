"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import HeroAgentSection from "@/components/HeroAgentSection";

type Course = {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  category?: string;
  year?: string;
  thumbnailUrl?: string;
  accessMonths?: number;
  durationLabel?: string;
  shortDescription?: string;
  isPublished?: boolean;
};

type SortKey = "new" | "old" | "az" | "za";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "new", label: "Шинэ нь эхэндээ" },
  { key: "old", label: "Хуучин нь эхэндээ" },
  { key: "az", label: "Худалдаж аваагүй нь эхэндээ" },
  { key: "za", label: "Худалдаж авсан нь эхэндээ" },
];

export default function HomeClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [courseQuery, setCourseQuery] = useState("");
  const [courseSort, setCourseSort] = useState<SortKey>("new");

  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user, userDoc, loading: loadingAuth, purchasedCourseIds } = useAuth() as any;

  const purchasedSet = useMemo(
    () => new Set<string>(purchasedCourseIds ?? []),
    [purchasedCourseIds]
  );

  function hasValidCourseAccess(courseId: string): boolean {
    if (!user) return false;
    const purchase = userDoc?.purchases?.[courseId];
    if (!purchase) return false;
    if (purchase.status !== "PAID") return false;
    if (purchase.active === false) return false;
    const raw = purchase.expiresAt;
    if (!raw) return false;
    const expDate: Date =
      typeof raw?.toDate === "function" ? raw.toDate() : new Date(raw);
    if (isNaN(expDate.getTime())) return false;
    return expDate.getTime() > Date.now();
  }

  const currentUrl = useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname || "/";
  }, [pathname, searchParams]);

  const goLogin = () => {
    router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
  };

  useEffect(() => {
    let alive = true;

    const loadCourses = async () => {
      try {
        const qRef = query(
          collection(db, "courses"),
          where("isPublished", "==", true)
        );

        const snap = await getDocs(qRef);

        const listPublic: Course[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        if (alive) setCourses(listPublic);
      } catch (e) {
        console.error("courses fetch error:", e);
      } finally {
        if (alive) setLoadingCourses(false);
      }
    };

    loadCourses();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = sortWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setSortOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();

    const getYearNum = (c: Course) => {
      const y = Number(String(c.year ?? "").trim());
      return Number.isFinite(y) ? y : 0;
    };

    const base = q
      ? courses.filter((c) => (c.title ?? "").toLowerCase().includes(q))
      : courses;

    const out = [...base];

    out.sort((a, b) => {
      const at = (a.title ?? "").toLowerCase();
      const bt = (b.title ?? "").toLowerCase();

      const ap = purchasedSet.has(a.id);
      const bp = purchasedSet.has(b.id);

      if (courseSort === "az") {
        if (ap !== bp) return ap ? 1 : -1;
        return at.localeCompare(bt);
      }

      if (courseSort === "za") {
        if (ap !== bp) return ap ? -1 : 1;
        return at.localeCompare(bt);
      }

      const ay = getYearNum(a);
      const by = getYearNum(b);

      if (courseSort === "new") {
        if (by !== ay) return by - ay;
        return at.localeCompare(bt);
      }

      if (ay !== by) return ay - by;
      return at.localeCompare(bt);
    });

    return out;
  }, [courses, courseQuery, courseSort, purchasedSet]);

  const sortLabel =
    SORT_OPTIONS.find((o) => o.key === courseSort)?.label ?? "Шинэ нь эхэндээ";

  return (
    <>
      <HeroAgentSection
        isAuthed={!!user}
        loadingAuth={loadingAuth}
        onLogin={goLogin}
      />

      <section id="contents" className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-black">БАГЦ ХИЧЭЭЛҮҮД</h2>
          <Link
            href="/contents"
            className="text-sm text-black/60 hover:text-black"
          >
            Бүгдийг үзэх
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[420px]">
              <input
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Контент хайх"
                aria-label="Контент хайх"
                className="w-full rounded-full border border-black/10 bg-white px-4 py-3 pr-10 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/20 focus:ring-2 focus:ring-black/10"
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/45">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.5 16.5 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div ref={sortWrapRef} className="relative w-full sm:w-[260px]">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black outline-none hover:bg-black/5 focus:border-black/20 focus:ring-2 focus:ring-black/10"
                aria-haspopup="listbox"
                aria-expanded={sortOpen ? "true" : "false"}
              >
                <span className="truncate">{sortLabel}</span>
                <span
                  className={`ml-3 inline-flex transition-transform ${
                    sortOpen ? "rotate-180" : ""
                  }`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {sortOpen ? (
                <div
                  className="absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-black/15 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
                  role="listbox"
                  aria-label="Эрэмбэлэх"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const active = opt.key === courseSort;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setCourseSort(opt.key);
                          setSortOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-4 py-3 text-sm ${
                          active
                            ? "bg-black/5 text-black"
                            : "text-black/80 hover:bg-black/5 hover:text-black"
                        }`}
                        role="option"
                        aria-selected={active ? "true" : "false"}
                      >
                        <span className="truncate">{opt.label}</span>
                        {active ? <span className="text-black/70">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {loadingCourses ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-black/10 bg-white p-3"
              >
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-black/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((c) => (
              <CourseCard
                key={c.id}
                course={c as any}
                isPurchased={hasValidCourseAccess(c.id)}
                href={`/course/${c.id}`}
              />
            ))}
          </div>
        )}

        <div className="h-6" />
      </section>
    </>
  );
}