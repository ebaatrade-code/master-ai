"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function ProgressPage() {
  const router = useRouter();
  const { user, userDoc, loading } = useAuth();

  const [totalCourses, setTotalCourses] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);

  // Auth хамгаалалт
  useEffect(() => {
    if (!loading && !user) router.push("/login?callbackUrl=%2Fprogress");
  }, [loading, user, router]);

  useEffect(() => {
    const run = async () => {
      setFetching(true);
      try {
        // ✅ Firestore дээр courses collection байна гэж үзлээ
        // Хэрвээ өөр нэртэй бол чи хэл — би бүтнээр нь өөрчилж өгнө.
        const snap = await getDocs(collection(db, "courses"));
        setTotalCourses(snap.size);
      } catch (e) {
        console.error(e);
        setTotalCourses(0);
      } finally {
        setFetching(false);
      }
    };
    if (user) run();
  }, [user]);

  const purchased = userDoc?.purchasedCourseIds?.length ?? 0;

  const percent = useMemo(() => {
    if (!totalCourses || totalCourses <= 0) return 0;
    const p = Math.round((purchased / totalCourses) * 100);
    return Math.max(0, Math.min(100, p));
  }, [purchased, totalCourses]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Ахиц / Progress</h1>
          <p className="mt-1 text-sm text-white/60">
            Таны сургалтын явцын ерөнхий дүр зураг.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/my-content" className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            Миний сургалтууд
          </Link>
          <Link href="/profile" className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            Profile
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-white/60">Нийт ахиц</div>
            <div className="mt-1 text-2xl font-semibold">{percent}%</div>
          </div>

          <div className="text-sm text-white/70">
            Авсан курс: <span className="text-white/90 font-semibold">{purchased}</span>
            {"  "}•{"  "}
            Нийт курс:{" "}
            <span className="text-white/90 font-semibold">
              {totalCourses === null ? "…" : totalCourses}
            </span>
          </div>
        </div>

        <div className="mt-4 h-3 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/40"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/contents"
            className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Курс нэмэх →
          </Link>
          <Link
            href="/my-content"
            className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Үргэлжлүүлэх →
          </Link>
        </div>

        {(loading || fetching) && (
          <div className="mt-4 text-sm text-white/50">Мэдээлэл ачаалж байна...</div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="text-sm text-white/60">Урамшуулал</div>
          <div className="mt-1 font-semibold">Дараагийн түвшин хүртэл</div>
          <div className="mt-2 text-sm text-white/80">
            Одоохондоо энгийнээр: өөр 1 курс авбал таны түвшин өсөх боломжтой болно.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="text-sm text-white/60">Санал</div>
          <div className="mt-1 font-semibold">Өнөөдөр 10 минут</div>
          <div className="mt-2 text-sm text-white/80">
            Өнөөдөр нэг л хичээлээ 10 минут үз — “буцаад орж ирэх” зуршил хамгийн хурдан тогтдог.
          </div>
        </div>
      </div>
    </div>
  );
}
