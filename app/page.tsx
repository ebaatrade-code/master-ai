"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";
import FreeLessonCard from "@/components/FreeLessonCard";

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

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // ✅ Free lessons state
  const [freeLessons, setFreeLessons] = useState<FreeLesson[]>([]);
  const [loadingFree, setLoadingFree] = useState(true);

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

  // ✅ Free Lessons: зөвхөн auth тогтоод + user байгаа үед fetch
  useEffect(() => {
    let alive = true;

    const loadFree = async () => {
      // auth state тогтохыг хүлээнэ
      if (loadingAuth) return;

      // ✅ login биш бол fetch хийхгүй (permissions error-оос хамгаална)
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

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="mx-auto max-w-6xl px-6 pt-14">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 md:p-10">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="relative h-[240px] w-full md:h-[320px]">
              <Image
                src="/hero.jpg"
                alt="Master AI Hero"
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-4xl">
                ХИЙМЭЛ ОЮУН УХААНЫ МАСТЕРУУД
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Мэдлэгээ өнөөдөр тэлж эхэл. Монголын хамгийн шилдэг AI онлайн
                сургалт.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/contents"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90"
                >
                  Контентууд үзэх
                </Link>

                {loadingAuth ? (
                  <div className="h-[46px] w-[140px] animate-pulse rounded-xl bg-white/10" />
                ) : user ? (
                  <Link
                    href="/my-content"
                    className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Миний контент
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={goLogin}
                    className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    Нэвтрэх
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 h-px bg-white/10" />
        </div>
      </section>

      {/* ================= CONTENTS ================= */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">БАГЦ ХИЧЭЭЛҮҮД</h2>
          <Link href="/contents" className="text-sm text-white/60 hover:text-white">
            Бүгдийг үзэх →
          </Link>
        </div>

        {loadingCourses ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c as any}
                isPurchased={purchasedSet.has(c.id)}
                href={`/course/${c.id}`}
              />
            ))}
          </div>
        )}

        <div className="h-4" />
      </section>

      {/* ================= ✅ FREE LESSONS ================= */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <div className="mt-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">ҮНЭГҮЙ ХИЧЭЭЛҮҮД</h2>

          <Link href="/free" className="text-sm text-white/60 hover:text-white">
            Бүгдийг үзэх →
          </Link>
        </div>

        {loadingAuth || loadingFree ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <span className="font-extrabold text-white">
              Зөвхөн нэвтэрч орсон хүмүүст ҮНЭГҮЙ ХИЧЭЭЛ харагдана.
            </span>
          </div>
        ) : freeLessons.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
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
            className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/15"
          >
            Бүх хичээлүүдийг үзэх →
          </Link>
        </div>

        <div className="h-10" />
      </section>
    </>
  );
}
