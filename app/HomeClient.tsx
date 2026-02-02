// app/HomeClient.tsx
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

export default function HomeClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

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

      {/* FREE LESSONS */}
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
