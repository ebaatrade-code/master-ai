"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Course = { id: string; title?: string; price?: number };

type Purchase = {
  courseId: string;
  amount: number;
  status?: "paid" | "pending" | "failed";
  createdAt?: Timestamp | null;
};

type UserDocLite = { purchasedCourseIds?: string[] };

type Row = {
  courseId: string;
  title: string;
  soldCount: number;
  revenue: number; // ₮
};

function toDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBackKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(toDayKey(d));
  }
  return keys;
}

export default function AnalistClient() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  const [loadingData, setLoadingData] = useState(true);

  const [usersCount, setUsersCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [rev7, setRev7] = useState<Record<string, number>>({});
  const [rev30, setRev30] = useState<Record<string, number>>({});

  const [freeViews7, setFreeViews7] = useState(0);
  const [freeViews30, setFreeViews30] = useState(0);

  // table controls
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // ✅ Admin-only хамгаалалт
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login?callbackUrl=%2Fanalist");
      return;
    }
    if (role !== "admin") {
      router.replace("/");
      return;
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;

    const run = async () => {
      try {
        setLoadingData(true);

        // 1) courses
        const coursesSnap = await getDocs(collection(db, "courses"));
        const courses: Course[] = coursesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setCoursesCount(courses.length);

        const titleById = new Map<string, string>();
        const priceById = new Map<string, number>();
        courses.forEach((c) => {
          titleById.set(c.id, c.title ?? c.id);
          priceById.set(c.id, typeof c.price === "number" ? c.price : 0);
        });

        // 2) users count + fallback soldCount from purchasedCourseIds
        const usersSnap = await getDocs(collection(db, "users"));
        setUsersCount(usersSnap.size);

        const soldMap = new Map<string, number>();
        usersSnap.docs.forEach((d) => {
          const u = d.data() as UserDocLite;
          const ids = Array.isArray(u.purchasedCourseIds) ? u.purchasedCourseIds : [];
          const unique = Array.from(new Set(ids));
          unique.forEach((courseId) => {
            soldMap.set(courseId, (soldMap.get(courseId) ?? 0) + 1);
          });
        });

        // 3) purchases (real revenue + time series)
        // NOTE: purchases байхгүй байсан ч ажиллана.
        const purchasesSnap = await getDocs(collection(db, "purchases"));
        const purchases: Purchase[] = purchasesSnap.docs.map((d) => d.data() as any);

        const paid = purchases.filter((p) => (p.status ?? "paid") === "paid");

        const revenueMap = new Map<string, number>();
        let totalRev = 0;

        // time series buckets
        const keys7 = daysBackKeys(7);
        const keys30 = daysBackKeys(30);
        const bucket7: Record<string, number> = Object.fromEntries(keys7.map((k) => [k, 0]));
        const bucket30: Record<string, number> = Object.fromEntries(keys30.map((k) => [k, 0]));

        if (paid.length > 0) {
          // ✅ Real revenue
          for (const p of paid) {
            const amt = typeof p.amount === "number" ? p.amount : 0;
            totalRev += amt;
            revenueMap.set(p.courseId, (revenueMap.get(p.courseId) ?? 0) + amt);

            const dt = p.createdAt?.toDate?.();
            if (dt) {
              const k = toDayKey(dt);
              if (k in bucket7) bucket7[k] += amt;
              if (k in bucket30) bucket30[k] += amt;
            }
          }
        } else {
          // ⚠️ Fallback revenue = price * soldCount (түр)
          for (const [courseId, soldCount] of soldMap.entries()) {
            const price = priceById.get(courseId) ?? 0;
            const rev = price * soldCount;
            totalRev += rev;
            revenueMap.set(courseId, rev);
          }
        }

        setTotalRevenue(totalRev);
        setRev7(bucket7);
        setRev30(bucket30);

        // 4) free lesson views time-window (7/30)
        const freeSnap = await getDocs(collection(db, "freeLessonViews"));
        const views = freeSnap.docs.map((d) => d.data() as any);

        const now = Date.now();
        const ms7 = 7 * 24 * 60 * 60 * 1000;
        const ms30 = 30 * 24 * 60 * 60 * 1000;

        let c7 = 0;
        let c30 = 0;
        for (const v of views) {
          const dt: Date | null = v.createdAt?.toDate?.() ?? null;
          if (!dt) continue;
          const t = dt.getTime();
          if (now - t <= ms30) c30++;
          if (now - t <= ms7) c7++;
        }
        setFreeViews7(c7);
        setFreeViews30(c30);

        // 5) build rows
        const allCourseIds = new Set<string>([
          ...Array.from(soldMap.keys()),
          ...Array.from(revenueMap.keys()),
          ...courses.map((c) => c.id),
        ]);

        const list: Row[] = Array.from(allCourseIds).map((courseId) => {
          const title = titleById.get(courseId) ?? courseId;
          const soldCount = soldMap.get(courseId) ?? 0;
          const revenue = revenueMap.get(courseId) ?? 0;
          return { courseId, title, soldCount, revenue };
        });

        list.sort((a, b) => b.revenue - a.revenue);
        setRows(list);
      } catch (e) {
        console.error("ANALIST load error:", e);
      } finally {
        setLoadingData(false);
      }
    };

    run();
  }, [loading, user, role]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(s) || r.courseId.toLowerCase().includes(s));
  }, [rows, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(pageCount, Math.max(1, page));
  const sliced = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const max7 = Math.max(...Object.values(rev7 || { a: 0 }));
  const max30 = Math.max(...Object.values(rev30 || { a: 0 }));

  if (loading || loadingData) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-10 w-60 rounded-xl bg-white/10 animate-pulse" />
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
        </div>
        <div className="mt-6 h-64 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!user || role !== "admin") return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ANALIST</h1>
          <p className="mt-1 text-sm text-white/70">Admin-only dashboard</p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/70">{user.email}</div>
      </div>

      {/* KPI */}
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">Нийт хэрэглэгч</div>
          <div className="mt-2 text-3xl font-semibold">{usersCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">Нийт курс</div>
          <div className="mt-2 text-3xl font-semibold">{coursesCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">Нийт орлого</div>
          <div className="mt-2 text-3xl font-semibold">{totalRevenue.toLocaleString()}₮</div>
          <div className="mt-1 text-xs text-white/50">purchases байвал real / байхгүй бол fallback</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">Free views (7 / 30)</div>
          <div className="mt-2 text-3xl font-semibold">
            {freeViews7} / {freeViews30}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-medium">Сүүлийн 7 хоног — Орлого (₮)</div>
          <div className="mt-3 flex items-end gap-1 h-28">
            {Object.entries(rev7).map(([k, v]) => (
              <div key={k} className="flex-1">
                <div
                  title={`${k}: ${v.toLocaleString()}₮`}
                  className="w-full rounded-md bg-white/20"
                  style={{ height: `${max7 ? (v / max7) * 100 : 0}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-white/50">purchases.createdAt дээр суурилна</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-medium">Сүүлийн 30 хоног — Орлого (₮)</div>
          <div className="mt-3 flex items-end gap-1 h-28">
            {Object.entries(rev30).map(([k, v]) => (
              <div key={k} className="flex-1">
                <div
                  title={`${k}: ${v.toLocaleString()}₮`}
                  className="w-full rounded-md bg-white/20"
                  style={{ height: `${max30 ? (v / max30) * 100 : 0}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-white/50">purchases.createdAt дээр суурилна</div>
        </div>
      </section>

      {/* Full table */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium">Бүгдийг харах — Курсийн орлого</div>
            <div className="mt-1 text-xs text-white/60">Нэр + зарагдсан + нийт орлого</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search курс..."
              className="h-9 w-56 rounded-full border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/40"
            />
            <button
              onClick={() => router.push("/admin")}
              className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            >
              ADMIN
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-12 bg-black/30 px-4 py-2 text-xs text-white/60">
            <div className="col-span-6">Курс</div>
            <div className="col-span-2 text-right">Зарагдсан</div>
            <div className="col-span-4 text-right">Нийт орлого (₮)</div>
          </div>

          {sliced.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">Илэрц олдсонгүй.</div>
          ) : (
            sliced.map((r) => (
              <div key={r.courseId} className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-white/10">
                <div className="col-span-6">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-white/50">{r.courseId}</div>
                </div>
                <div className="col-span-2 text-right font-semibold">{r.soldCount}</div>
                <div className="col-span-4 text-right font-semibold">
                  {r.revenue.toLocaleString()}₮
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-white/50">
            Нийт: {filtered.length} • Page {pageSafe}/{pageCount}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
              disabled={pageSafe <= 1}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
              disabled={pageSafe >= pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
