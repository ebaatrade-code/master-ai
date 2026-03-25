"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
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

  // ✅ NEW: visibility
  isPublished?: boolean;
};

export default function ContentsPage() {
  // ✅ role авна (admin бол бүхнийг харуулахад хэрэгтэй)
  const { user, userDoc, loading, purchasedCourseIds, role } = useAuth() as any;

  const purchasedSet = useMemo(
    () => new Set(purchasedCourseIds ?? []),
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

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadCourses = async () => {
      setFetching(true);
      setErr(null);

      try {
        // Admin бол бүгдийг, энгийн хэрэглэгч бол isPublished==true-г л татна
        // (Firestore rules isPublished==true query-г л зөвшөөрдөг)
        const q =
          role === "admin"
            ? query(collection(db, "courses"), orderBy("title", "asc"))
            : query(collection(db, "courses"), where("isPublished", "==", true));
        const snap = await getDocs(q);

        const list: Course[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...(data ?? {}),
            id: d.id,
            title: data?.title ?? "(Гарчиггүй)",
          } as Course;
        });

        const visible = list;

        if (alive) setCourses(visible);
      } catch (e) {
        console.error("loadCourses error:", e);
        if (alive) setErr("Контент уншихад алдаа гарлаа.");
      } finally {
        if (alive) setFetching(false);
      }
    };

    loadCourses();

    return () => {
      alive = false;
    };
  }, [role]);

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
      <p className="mt-2 text-sm text-black/60"></p>

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
            return (
              <CourseCard
                key={c.id}
                course={c}
                isPurchased={hasValidCourseAccess(c.id)}
                href={`/course/${c.id}`}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}