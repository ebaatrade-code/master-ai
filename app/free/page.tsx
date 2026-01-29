"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type FreeLesson = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl: string;
};

export default function FreeListPage() {
  const [items, setItems] = useState<FreeLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        setLoading(true);
        const qFree = query(
          collection(db, "freeLessons"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qFree);

        const list: FreeLesson[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        if (alive) setItems(list);
      } catch (e) {
        console.error("free list fetch error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Үнэгүй хичээлүүд</h1>
        <Link href="/" className="text-sm text-white/60 hover:text-white">
          Нүүр →
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Ачаалж байна...
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Одоогоор үнэгүй хичээл алга.
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((v) => (
            <Link
              key={v.id}
              href={`/free/${v.id}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
            >
              <div className="aspect-[16/10] w-full overflow-hidden rounded-xl">
                {v.thumbnailUrl ? (
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm text-white/40">
                    Thumbnail байхгүй
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="mt-2 line-clamp-2 text-sm font-semibold">
                  {v.title}
                </div>
                <div className="mt-3 text-sm font-bold text-white/70">Үнэгүй</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
