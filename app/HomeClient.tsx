// app/HomeClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import FreeLessonCard from "@/components/FreeLessonCard";
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
};

type FreeLesson = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl: string;
  createdAt?: any;
};

type SortKey = "new" | "old" | "az" | "za";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "new", label: "Шинэ нь эхэндээ" },
  { key: "old", label: "Хуучин нь эхэндээ" },
  { key: "az", label: "A-Z" },
  { key: "za", label: "Z-A" },
];

export default function HomeClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [freeLessons, setFreeLessons] = useState<FreeLesson[]>([]);
  const [loadingFree, setLoadingFree] = useState(true);

  // ✅ Toolbar state
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSort, setCourseSort] = useState<SortKey>("new");

  // ✅ Custom dropdown state (native select-ийг болиулсан)
  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user, loading: loadingAuth, purchasedCourseIds } = useAuth() as any;

  const purchasedSet = useMemo(
    () => new Set<string>(purchasedCourseIds ?? []),
    [purchasedCourseIds]
  );

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
        const qRef = query(collection(db, "courses"), orderBy("title", "asc"));
        const snap = await getDocs(qRef);

        const list: Course[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        if (alive) setCourses(list);
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
    let alive = true;

    const loadFree = async () => {
      if (loadingAuth) return;

      if (!user) {
        if (alive) {
          setFreeLessons([]);
          setLoadingFree(false);
        }
        return;
      }

      try {
        if (alive) setLoadingFree(true);

        const qFree = query(
          collection(db, "freeLessons"),
          orderBy("createdAt", "desc")
        );
        const snapFree = await getDocs(qFree);

        const listFree: FreeLesson[] = snapFree.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        if (alive) setFreeLessons(listFree);
      } catch (e) {
        console.error("freeLessons fetch error:", e);
        if (alive) setFreeLessons([]);
      } finally {
        if (alive) setLoadingFree(false);
      }
    };

    loadFree();

    return () => {
      alive = false;
    };
  }, [loadingAuth, user]);

  // ✅ Close dropdown on outside click / Esc
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

  // ✅ Toolbar logic
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

      if (courseSort === "az") return at.localeCompare(bt);
      if (courseSort === "za") return bt.localeCompare(at);

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
  }, [courses, courseQuery, courseSort]);

  const sortLabel =
    SORT_OPTIONS.find((o) => o.key === courseSort)?.label ?? "Шинэ нь эхэндээ";

  return (
    <>
      {/* HERO (NEW AI AGENT) */}
      <HeroAgentSection
        isAuthed={!!user}
        loadingAuth={loadingAuth}
        onLogin={goLogin}
      />

      {/* CONTENTS */}
      <section id="contents" className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-black md:text-white">
            БАГЦ ХИЧЭЭЛҮҮД
          </h2>
          <Link
            href="/contents"
            className="text-sm text-black/60 hover:text-black md:text-white/60 md:hover:text-white"
          >
            Бүгдийг үзэх →
          </Link>
        </div>

        {/* ✅ Toolbar */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:w-[420px]">
              <input
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Контент хайх"
                className="
                  w-full rounded-full
                  border border-black/10 bg-white
                  px-4 py-3 pr-10
                  text-sm text-black
                  outline-none
                  placeholder:text-black/35
                  focus:border-black/20
                  focus:ring-2 focus:ring-black/10

                  md:border-white/10 md:bg-white/5
                  md:text-white/85
                  md:placeholder:text-white/35
                  md:focus:border-white/20
                  md:focus:ring-white/10
                "
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/45 md:text-white/45">
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

            {/* ✅ Custom Sort Dropdown */}
            <div ref={sortWrapRef} className="relative w-full sm:w-[260px]">
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className="
                  flex w-full items-center justify-between
                  rounded-full
                  border border-black/10 bg-white
                  px-4 py-3
                  text-sm font-semibold text-black
                  outline-none
                  hover:bg-black/5
                  focus:border-black/20
                  focus:ring-2 focus:ring-black/10

                  md:border-white/10 md:bg-white/5
                  md:text-white/85
                  md:hover:bg-white/10
                  md:focus:border-white/20
                  md:focus:ring-white/10
                "
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
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
                  className="
                    absolute right-0 z-50 mt-2 w-full overflow-hidden
                    rounded-2xl
                    border border-black/10
                    bg-white
                    shadow-[0_16px_40px_rgba(0,0,0,0.12)]

                    md:border-white/10
                    md:bg-black/80 md:backdrop-blur-xl
                    md:shadow-[0_16px_40px_rgba(0,0,0,0.55)]
                  "
                  role="listbox"
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
                        className={`
                          flex w-full items-center justify-between
                          px-4 py-3 text-sm
                          ${
                            active
                              ? "bg-black/5 text-black md:bg-white/10 md:text-white"
                              : "text-black/80 hover:bg-black/5 hover:text-black md:text-white/80 md:hover:bg-white/5 md:hover:text-white"
                          }
                        `}
                        role="option"
                        aria-selected={active}
                      >
                        <span className="truncate">{opt.label}</span>
                        {active ? (
                          <span className="text-black/70 md:text-white/90">
                            ✓
                          </span>
                        ) : null}
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
                className="rounded-2xl border border-black/10 bg-white p-3 md:border-white/10 md:bg-white/5"
              >
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-black/5 md:bg-white/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((c) => (
              <CourseCard
                key={c.id}
                course={c as any}
                isPurchased={purchasedSet.has(c.id)}
                href={`/course/${c.id}`}
              />
            ))}
          </div>
        )}

        <div className="h-6" />
      </section>

      {/* FREE LESSONS */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <div className="mt-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-black md:text-white">
            ҮНЭГҮЙ ХИЧЭЭЛҮҮД
          </h2>

          <Link
            href="/free"
            className="text-sm text-black/60 hover:text-black md:text-white/60 md:hover:text-white"
          >
            Бүгдийг үзэх →
          </Link>
        </div>

        {loadingAuth || loadingFree ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-black/10 bg-white p-3 md:border-white/10 md:bg-white/5"
              >
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-black/5 md:bg-white/5" />
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm md:border-white/10 md:bg-white/5">
            <span className="font-extrabold text-black md:text-white">
              Зөвхөн нэвтэрч орсон хүмүүст ҮНЭГҮЙ ХИЧЭЭЛ харагдана.
            </span>
          </div>
        ) : freeLessons.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70 md:border-white/10 md:bg-white/5 md:text-white/70">
            Одоогоор үнэгүй хичээл алга байна.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {freeLessons.map((v) => (
              <FreeLessonCard key={v.id} lesson={v} href={`/free/${v.id}`} />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/contents"
            className="
              rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:opacity-90
              md:bg-white/10 md:text-white/80 md:hover:bg-white/15
            "
          >
            Бүх хичээлүүдийг үзэх →
          </Link>
        </div>

        <div className="h-10" />
      </section>
    </>
  );
}