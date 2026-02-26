"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Course = { id: string; title?: string; price?: number };

type Purchase = {
  courseId?: string;
  amount?: number;

  status?: string;
  paid?: boolean;

  createdAt?: any;
  paidAt?: any;
  paidTime?: any;
  updatedAt?: any;
};

type UserDocLite = { purchasedCourseIds?: string[] };

type Row = {
  courseId: string;
  title: string;
  soldCount: number;
  revenue: number; // ₮ (all-time PAID)
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asDate(v: any): Date | null {
  try {
    if (!v) return null;

    if (v instanceof Date) {
      return Number.isNaN(v.getTime()) ? null : v;
    }

    if (typeof v?.toDate === "function") {
      const d: Date = v.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const secs = v?.seconds;
    if (typeof secs === "number") {
      const ms =
        secs * 1000 +
        (typeof v?.nanoseconds === "number" ? Math.floor(v.nanoseconds / 1e6) : 0);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function isPaidLike(p: Purchase) {
  if (p?.paid === true) return true;

  const s = String(p?.status ?? "").trim().toUpperCase();
  if (!s) {
    if (p?.paidAt || p?.paidTime) return true;
    return false;
  }

  if (s === "PAID") return true;
  if (s === "SUCCESS" || s === "SUCCEEDED") return true;
  if (s === "COMPLETED" || s === "COMPLETE") return true;
  if (s === "DONE") return true;

  return false;
}

function getEventTime(p: Purchase): Date | null {
  return (
    asDate(p?.paidAt) ||
    asDate(p?.paidTime) ||
    asDate(p?.createdAt) ||
    asDate(p?.updatedAt) ||
    null
  );
}

export default function AnalistPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  const [loadingData, setLoadingData] = useState(true);

  const [usersCount, setUsersCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [rev7, setRev7] = useState<Record<string, number>>({});
  const [rev30, setRev30] = useState<Record<string, number>>({});

  const [rev365Total, setRev365Total] = useState(0);
  const [rev30Total, setRev30Total] = useState(0);
  const [rev7Total, setRev7Total] = useState(0);

  const [freeViews7, setFreeViews7] = useState(0);
  const [freeViews30, setFreeViews30] = useState(0);

  const [qText, setQText] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const titleByIdRef = useRef<Map<string, string>>(new Map());
  const priceByIdRef = useRef<Map<string, number>>(new Map());
  const soldFallbackRef = useRef<Map<string, number>>(new Map());

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

    let alive = true;

    const run = async () => {
      try {
        setLoadingData(true);

        const coursesSnap = await getDocs(collection(db, "courses"));
        const courses: Course[] = coursesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        if (!alive) return;

        setCoursesCount(courses.length);

        const titleById = new Map<string, string>();
        const priceById = new Map<string, number>();
        courses.forEach((c) => {
          titleById.set(c.id, c.title ?? c.id);
          priceById.set(c.id, typeof c.price === "number" ? c.price : 0);
        });

        titleByIdRef.current = titleById;
        priceByIdRef.current = priceById;

        const usersSnap = await getDocs(collection(db, "users"));
        if (!alive) return;

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
        soldFallbackRef.current = soldMap;

        const freeSnap = await getDocs(collection(db, "freeLessonViews"));
        if (!alive) return;

        const views = freeSnap.docs.map((d) => d.data() as any);
        const now = Date.now();
        const ms7 = 7 * 24 * 60 * 60 * 1000;
        const ms30 = 30 * 24 * 60 * 60 * 1000;

        let c7 = 0;
        let c30 = 0;
        for (const v of views) {
          const dt: Date | null = asDate(v?.createdAt);
          if (!dt) continue;
          const t = dt.getTime();
          if (now - t <= ms30) c30++;
          if (now - t <= ms7) c7++;
        }
        setFreeViews7(c7);
        setFreeViews30(c30);
      } catch (e) {
        console.error("ANALIST static load error:", e);
      } finally {
        if (alive) setLoadingData(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [loading, user, role]);

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;

    const unsubs: Array<() => void> = [];

    let purchasesDocs: Array<{ source: "purchases"; id: string; data: Purchase }> = [];
    let invoicesDocs: Array<{ source: "invoices"; id: string; data: Purchase }> = [];

    const recompute = () => {
      const titleById = titleByIdRef.current;
      const priceById = priceByIdRef.current;
      const soldFallback = soldFallbackRef.current;

      const docs = [...purchasesDocs, ...invoicesDocs];

      const now = Date.now();
      const ms7 = 7 * 24 * 60 * 60 * 1000;
      const ms30 = 30 * 24 * 60 * 60 * 1000;
      const ms365 = 365 * 24 * 60 * 60 * 1000;

      const keys7 = daysBackKeys(7);
      const keys30 = daysBackKeys(30);
      const bucket7: Record<string, number> = Object.fromEntries(keys7.map((k) => [k, 0]));
      const bucket30: Record<string, number> = Object.fromEntries(keys30.map((k) => [k, 0]));

      const revenueMap = new Map<string, number>();
      const soldMap = new Map<string, number>();

      let totalAll = 0;
      let total7 = 0;
      let total30 = 0;
      let total365 = 0;

      const paidDocs = docs.filter((x) => isPaidLike(x.data));

      if (paidDocs.length > 0) {
        for (const x of paidDocs) {
          const p = x.data;

          const courseId = String(p.courseId ?? "").trim();
          const amt = typeof p.amount === "number" ? p.amount : 0;

          totalAll += amt;

          if (courseId) {
            revenueMap.set(courseId, (revenueMap.get(courseId) ?? 0) + amt);
            soldMap.set(courseId, (soldMap.get(courseId) ?? 0) + 1);
          }

          const dt = getEventTime(p);
          if (!dt) continue;

          const age = now - dt.getTime();

          if (age >= 0 && age <= ms365) total365 += amt;
          if (age >= 0 && age <= ms30) total30 += amt;
          if (age >= 0 && age <= ms7) total7 += amt;

          const k = toDayKey(dt);
          if (k in bucket7) bucket7[k] += amt;
          if (k in bucket30) bucket30[k] += amt;
        }

        setTotalRevenue(totalAll);
        setRev7(bucket7);
        setRev30(bucket30);
        setRev7Total(total7);
        setRev30Total(total30);
        setRev365Total(total365);

        const allCourseIds = new Set<string>([
          ...Array.from(revenueMap.keys()),
          ...Array.from(soldMap.keys()),
          ...Array.from(titleById.keys()),
        ]);

        const list: Row[] = Array.from(allCourseIds).map((id) => ({
          courseId: id,
          title: titleById.get(id) ?? id,
          soldCount: soldMap.get(id) ?? 0,
          revenue: revenueMap.get(id) ?? 0,
        }));

        list.sort((a, b) => b.revenue - a.revenue);
        setRows(list);
        return;
      }

      const revenueMapFallback = new Map<string, number>();
      let totalRev = 0;

      for (const [courseId, soldCount] of soldFallback.entries()) {
        const price = priceById.get(courseId) ?? 0;
        const rev = price * soldCount;
        totalRev += rev;
        revenueMapFallback.set(courseId, rev);
      }

      setTotalRevenue(totalRev);
      setRev7(bucket7);
      setRev30(bucket30);
      setRev7Total(0);
      setRev30Total(0);
      setRev365Total(0);

      const allCourseIds = new Set<string>([
        ...Array.from(soldFallback.keys()),
        ...Array.from(revenueMapFallback.keys()),
        ...Array.from(titleById.keys()),
      ]);

      const list: Row[] = Array.from(allCourseIds).map((id) => ({
        courseId: id,
        title: titleById.get(id) ?? id,
        soldCount: soldFallback.get(id) ?? 0,
        revenue: revenueMapFallback.get(id) ?? 0,
      }));

      list.sort((a, b) => b.revenue - a.revenue);
      setRows(list);
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, "purchases")),
        (snap) => {
          purchasesDocs = snap.docs.map((d) => ({
            source: "purchases",
            id: d.id,
            data: d.data() as any,
          }));
          recompute();
        },
        (err) => console.error("ANALIST purchases onSnapshot error:", err)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "invoices")),
        (snap) => {
          invoicesDocs = snap.docs.map((d) => ({
            source: "invoices",
            id: d.id,
            data: d.data() as any,
          }));
          recompute();
        },
        (err) => console.error("ANALIST invoices onSnapshot error:", err)
      )
    );

    return () => unsubs.forEach((fn) => fn());
  }, [loading, user, role]);

  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(s) || r.courseId.toLowerCase().includes(s)
    );
  }, [rows, qText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(pageCount, Math.max(1, page));
  const sliced = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe]);

  useEffect(() => setPage(1), [qText]);

  const max7 = Math.max(...Object.values(rev7 || { a: 0 }));
  const max30 = Math.max(...Object.values(rev30 || { a: 0 }));

  if (loading || loadingData) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 md:max-w-[1180px] md:px-6 md:py-12">
        <div className="h-10 w-60 rounded-xl bg-white/10 animate-pulse" />
        <div className="mt-6 grid gap-4 md:grid-cols-4 md:gap-6">
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
    <main className="mx-auto max-w-6xl px-4 py-10 md:max-w-[1180px] md:px-6 md:py-12 lg:max-w-[1240px] text-black">
      <div className="flex items-end justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-2xl font-semibold md:text-[28px] md:tracking-tight text-black">
            ANALIST
          </h1>
          <p className="mt-1 text-sm text-black md:mt-1.5 md:text-[13px] md:text-black">
            Admin-only dashboard
          </p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-2 text-xs text-black md:bg-white/[0.08] md:px-4 md:py-2.5 md:text-[12px]">
          {user.email}
        </div>
      </div>

      {/* KPI */}
      <section className="mt-6 grid gap-4 md:grid-cols-4 md:gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm text-black md:text-[12px] md:text-black">Нийт хэрэглэгч</div>
          <div className="mt-2 text-3xl font-semibold md:mt-3 md:text-[34px] text-black">
            {usersCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm text-black md:text-[12px] md:text-black">Нийт курс</div>
          <div className="mt-2 text-3xl font-semibold md:mt-3 md:text-[34px] text-black">
            {coursesCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm text-black md:text-[12px] md:text-black">Нийт орлого</div>
          <div className="mt-2 text-3xl font-semibold md:mt-3 md:text-[34px] text-black">
            {totalRevenue.toLocaleString()}₮
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm text-black md:text-[12px] md:text-black">Free views (7 / 30)</div>
          <div className="mt-2 text-3xl font-semibold md:mt-3 md:text-[34px] text-black">
            {freeViews7} / {freeViews30}
          </div>
        </div>
      </section>

      {/* ✅ 7 / 30 / 1 жил — desktop дээр 3 багана, spacing адилхан */}
      <section className="mt-6 grid gap-4 md:grid-cols-3 md:gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm font-medium md:text-[13px] md:text-black text-black">
            Сүүлийн 7 хоног — Орлого (₮)
          </div>
          <div className="hidden md:block md:mt-2 md:text-[22px] md:font-semibold md:text-black text-black">
            {rev7Total.toLocaleString()}₮
          </div>
          <div className="mt-3 flex items-end gap-1 h-28 md:mt-4 md:h-32 md:gap-1.5">
            {Object.entries(rev7).map(([k, v]) => (
              <div key={k} className="flex-1">
                <div
                  title={`${k}: ${v.toLocaleString()}₮`}
                  className="w-full rounded-md bg-black/20 md:rounded-lg md:bg-black/20"
                  style={{ height: `${max7 ? clamp((v / max7) * 100, 0, 100) : 0}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="text-sm font-medium md:text-[13px] md:text-black text-black">
            Сүүлийн 30 хоног — Орлого (₮)
          </div>
          <div className="hidden md:block md:mt-2 md:text-[22px] md:font-semibold md:text-black text-black">
            {rev30Total.toLocaleString()}₮
          </div>
          <div className="mt-3 flex items-end gap-1 h-28 md:mt-4 md:h-32 md:gap-1.5">
            {Object.entries(rev30).map(([k, v]) => (
              <div key={k} className="flex-1">
                <div
                  title={`${k}: ${v.toLocaleString()}₮`}
                  className="w-full rounded-md bg-black/20 md:rounded-lg md:bg-black/20"
                  style={{ height: `${max30 ? clamp((v / max30) * 100, 0, 100) : 0}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ✅ “Сүүлийн 1 жил” яг “Сүүлийн 30”-ын ард нэг мөрөнд орно */}
        <div className="hidden md:block rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-[13px] font-medium text-black">Сүүлийн 1 жил — Орлого (₮)</div>
          <div className="mt-3 text-[28px] font-semibold text-black">
            {rev365Total.toLocaleString()}₮
          </div>
          <div className="mt-2 text-[12px] text-black">PAID болсон цаг дээр суурилна</div>
        </div>

        {/* Давхардахгүй: доорх “Нийт — Орлого (₮)” card-г бүрмөсөн нуусан хэвээр */}
        <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-[13px] font-medium text-black">Нийт — Орлого (₮)</div>
          <div className="mt-3 text-[28px] font-semibold text-black">
            {totalRevenue.toLocaleString()}₮
          </div>
          <div className="mt-2 text-[12px] text-black">PAID болсон цаг дээр суурилна</div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 md:mt-8 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div>
            <div className="text-sm font-medium md:text-[13px] md:text-black text-black">
              Бүгдийг харах — Курсийн орлого
            </div>
            <div className="mt-1 text-xs text-black md:text-[12px] md:text-black">
              Нэр + зарагдсан + нийт орлого
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Search курс..."
              className="h-9 w-56 rounded-full border border-white/10 bg-black/30 px-4 text-sm text-black outline-none placeholder:text-black/50 md:h-10 md:w-[320px] md:text-[13px] md:bg-black/25 md:border-white/[0.12]"
            />
            <button
              onClick={() => router.push("/admin")}
              className="rounded-full bg-white/10 px-3 py-2 text-xs text-black hover:bg-white/15 md:px-4 md:py-2.5 md:text-[12px]"
            >
              ADMIN
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 md:mt-5 md:rounded-2xl md:border-white/[0.12]">
          <div className="grid grid-cols-12 bg-black/30 px-4 py-2 text-xs text-black md:px-5 md:py-3 md:text-[11px] md:bg-black/25">
            <div className="col-span-6">Курс</div>
            <div className="col-span-2 text-right">Зарагдсан</div>
            <div className="col-span-4 text-right">Нийт орлого (₮)</div>
          </div>

          {sliced.length === 0 ? (
            <div className="px-4 py-6 text-sm text-black md:px-5 md:py-10 md:text-[13px]">
              Илэрц олдсонгүй.
            </div>
          ) : (
            sliced.map((r) => (
              <div
                key={r.courseId}
                className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t border-white/10 md:px-5 md:py-4 md:text-[13px] text-black"
              >
                <div className="col-span-6">
                  <div className="font-medium text-black">{r.title}</div>
                  <div className="text-xs text-black md:hidden">{r.courseId}</div>
                </div>
                <div className="col-span-2 text-right font-semibold text-black">{r.soldCount}</div>
                <div className="col-span-4 text-right font-semibold text-black">
                  {r.revenue.toLocaleString()}₮
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between md:mt-5">
          <div className="text-xs text-black md:text-[12px] md:text-black">
            Нийт: {filtered.length} • Page {pageSafe}/{pageCount}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full bg-white/10 px-3 py-2 text-xs text-black hover:bg-white/15 md:px-4 md:py-2.5 md:text-[12px]"
              disabled={pageSafe <= 1}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-full bg-white/10 px-3 py-2 text-xs text-black hover:bg-white/15 md:px-4 md:py-2.5 md:text-[12px]"
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