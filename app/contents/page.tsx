"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/CourseCard";

type Course = {
  id: string;
  title: string;
  price?: number;
  oldPrice?: number;
  thumbnailUrl?: string;

  durationLabel?: string;
  shortDescription?: string;

  category?: string;
  year?: string;
};

export default function ContentsPage() {
  const { user, loading, purchasedCourseIds } = useAuth();

  const purchasedSet = useMemo(
    () => new Set(purchasedCourseIds ?? []),
    [purchasedCourseIds]
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const loadCourses = async () => {
      setFetching(true);
      setErr(null);
      try {
        const q = query(collection(db, "courses"), orderBy("title", "asc"));
        const snap = await getDocs(q);

        const list: Course[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...(data ?? {}),
            id: d.id,
            title: data?.title ?? "(Гарчиггүй)",
          } as Course;
        });

        setCourses(list);
      } catch (e) {
        console.error("loadCourses error:", e);
        setErr("Контент уншихад алдаа гарлаа.");
      } finally {
        setFetching(false);
      }
    };

    loadCourses();
  }, []);

  if (fetching) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-black">
        <h2 className="text-3xl font-extrabold">Контентууд</h2>
        <div className="mt-6 text-black/60">Уншиж байна...</div>
      </main>
    );
  }

  if (err) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-black">
        <h2 className="text-3xl font-extrabold">Контентууд</h2>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-black/70">
          {err}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-black">
      <h2 className="text-3xl font-extrabold">Контентууд</h2>
      <p className="mt-2 text-sm text-black/60">
 </p>

      {!loading && !user ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-black/70">
          🔒 Нэвтрээгүй байна. Видео үзэхийн тулд нэвтэрнэ үү.
        </div>
      ) : null}

      {courses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-black/70">
          Одоогоор контент алга байна.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const isPurchased = purchasedSet.has(c.id);

            return (
              <CourseCard
                key={c.id}
                course={c}
                isPurchased={isPurchased}
                href={`/course/${c.id}`}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
