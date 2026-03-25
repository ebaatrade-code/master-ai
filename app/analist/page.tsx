"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "1y" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 хоног",
  "30d": "30 хоног",
  "1y": "1 жил",
  "all": "Нийт",
};

type Entry = {
  id: string;
  ref?: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  uid: string;
  paidAt: Date | null;
};

type RawPurchase = {
  courseId?: string;
  courseTitle?: string;
  amount?: number;
  status?: string;
  paid?: boolean;
  uid?: string;
  ref?: string;
  paidAt?: any;
  paidTime?: any;
  createdAt?: any;
  updatedAt?: any;
};

type Row = {
  courseId: string;
  title: string;
  soldCount: number;
  revenue: number;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function asDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v?.toDate === "function") {
      const d: Date = v.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    const secs = v?.seconds;
    if (typeof secs === "number") {
      const ms = secs * 1000 + (typeof v?.nanoseconds === "number" ? Math.floor(v.nanoseconds / 1e6) : 0);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBackKeys(n: number): string[] {
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

function isPaidRaw(p: RawPurchase) {
  if (p.paid === true) return true;
  const s = String(p.status ?? "").toUpperCase();
  if (s === "PAID" || s === "SUCCESS" || s === "COMPLETED" || s === "DONE") return true;
  if (!s && (p.paidAt || p.paidTime)) return true;
  return false;
}

function getEntryDate(p: RawPurchase): Date | null {
  return asDate(p.paidAt) ?? asDate(p.paidTime) ?? asDate(p.createdAt) ?? asDate(p.updatedAt) ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalistPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  const [period, setPeriod] = useState<Period>("all");
  const [loadingData, setLoadingData] = useState(true);

  const [usersCount, setUsersCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);

  const titleByIdRef = useRef(new Map<string, string>());

  const [ledgerEntries, setLedgerEntries] = useState<Entry[]>([]);
  const [purchaseEntries, setPurchaseEntries] = useState<Entry[]>([]);

  const [qText, setQText] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login?callbackUrl=%2Fanalist"); return; }
    if (role !== "admin") { router.replace("/"); return; }
  }, [loading, user, role, router]);

  // ── Load courses + users count ─────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user || role !== "admin") return;
    let alive = true;

    const run = async () => {
      setLoadingData(true);
      try {
        const [coursesSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "users")),
        ]);
        if (!alive) return;

        const titleById = new Map<string, string>();
        coursesSnap.docs.forEach((d) => {
          titleById.set(d.id, (d.data() as any)?.title ?? d.id);
        });
        titleByIdRef.current = titleById;

        setCoursesCount(coursesSnap.size);
        setUsersCount(usersSnap.size);
      } catch (e) {
        console.error("ANALIST static load error:", e);
      } finally {
        if (alive) setLoadingData(false);
      }
    };

    run();
    return () => { alive = false; };
  }, [loading, user, role]);

  // ── Live: revenueLedger (immutable, keyed by payment ref) ──────────────────
  useEffect(() => {
    if (loading || !user || role !== "admin") return;

    const unsub = onSnapshot(
      query(collection(db, "revenueLedger")),
      (snap) => {
        const entries: Entry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ref: d.id,
            courseId: String(data.courseId ?? ""),
            courseTitle: String(
              data.courseTitle ||
              titleByIdRef.current.get(data.courseId) ||
              data.courseId ||
              d.id
            ),
            amount: typeof data.amount === "number" ? data.amount : 0,
            uid: String(data.uid ?? ""),
            paidAt: asDate(data.paidAt) ?? asDate(data.createdAt),
          };
        });
        setLedgerEntries(entries);
      },
      (err) => console.error("ANALIST revenueLedger error:", err)
    );

    return () => unsub();
  }, [loading, user, role]);

  // ── Live: purchases (historical fallback for pre-ledger data) ──────────────
  useEffect(() => {
    if (loading || !user || role !== "admin") return;

    const unsub = onSnapshot(
      query(collection(db, "purchases")),
      (snap) => {
        const entries: Entry[] = snap.docs
          .filter((d) => isPaidRaw(d.data() as RawPurchase))
          .map((d) => {
            const data = d.data() as RawPurchase;
            return {
              id: d.id,
              ref: data.ref,
              courseId: String(data.courseId ?? ""),
              courseTitle: String(
                data.courseTitle ||
                titleByIdRef.current.get(data.courseId ?? "") ||
                data.courseId ||
                d.id
              ),
              amount: typeof data.amount === "number" ? data.amount : 0,
              uid: String(data.uid ?? ""),
              paidAt: getEntryDate(data),
            };
          });
        setPurchaseEntries(entries);
      },
      (err) => console.error("ANALIST purchases error:", err)
    );

    return () => unsub();
  }, [loading, user, role]);

  // ── Merged entries: ledger is authoritative, purchases fill in history ─────
  const allEntries = useMemo(() => {
    const ledgerRefSet = new Set(ledgerEntries.map((e) => e.id));
    // purchases entries that don't have a corresponding ledger entry
    const purchaseFallback = purchaseEntries.filter(
      (e) => !e.ref || !ledgerRefSet.has(e.ref)
    );
    return [...ledgerEntries, ...purchaseFallback];
  }, [ledgerEntries, purchaseEntries]);

  // ── Period filter ──────────────────────────────────────────────────────────
  const startMs = useMemo(() => {
    if (period === "all") return 0;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 365;
    return Date.now() - days * 86400000;
  }, [period]);

  const periodEntries = useMemo(() => {
    if (period === "all") return allEntries;
    return allEntries.filter(
      (e) => e.paidAt !== null && e.paidAt.getTime() >= startMs
    );
  }, [allEntries, period, startMs]);

  // ── Computed stats for selected period ────────────────────────────────────
  const totalRevenue = useMemo(
    () => periodEntries.reduce((s, e) => s + e.amount, 0),
    [periodEntries]
  );

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const e of periodEntries) {
      if (!e.courseId) continue;
      const existing = map.get(e.courseId) ?? {
        courseId: e.courseId,
        title: e.courseTitle || titleByIdRef.current.get(e.courseId) || e.courseId,
        soldCount: 0,
        revenue: 0,
      };
      map.set(e.courseId, {
        ...existing,
        soldCount: existing.soldCount + 1,
        revenue: existing.revenue + e.amount,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodEntries]);

  // ── Bar chart buckets (only for 7d / 30d) ─────────────────────────────────
  const buckets = useMemo(() => {
    if (period !== "7d" && period !== "30d") return null;
    const days = period === "7d" ? 7 : 30;
    const keys = daysBackKeys(days);
    const b: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const e of periodEntries) {
      if (!e.paidAt) continue;
      const k = toDayKey(e.paidAt);
      if (k in b) b[k] += e.amount;
    }
    return b;
  }, [periodEntries, period]);

  const maxBucket = useMemo(
    () => (buckets ? Math.max(...Object.values(buckets), 0) : 0),
    [buckets]
  );

  // ── All-time totals (regardless of period tab) ─────────────────────────────
  const allTimeRevenue = useMemo(
    () => allEntries.reduce((s, e) => s + e.amount, 0),
    [allEntries]
  );
  const allTimeCount = allEntries.length;

  // ── Filtered + paginated table rows ───────────────────────────────────────
  const filtered = useMemo(() => {
    const s = qText.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        r.courseId.toLowerCase().includes(s)
    );
  }, [rows, qText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(pageCount, Math.max(1, page));

  const sliced = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe]);

  useEffect(() => { setPage(1); }, [qText, period]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
          <div className="mt-8 h-64 animate-pulse rounded-2xl bg-gray-200" />
          <div className="mt-4 h-96 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!user || role !== "admin") return null;

  return (
    <main className="min-h-screen bg-gray-50 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Статистик Самбар
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Орлого болон борлуулалтын дэлгэрэнгүй мэдээлэл
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-inset ring-gray-200 sm:flex">
              {user.email}
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              Админ тохиргоо
            </button>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(["7d", "30d", "1y", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                period === p
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Main Revenue Hero Card */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-sm">
          <p className="text-sm font-medium text-gray-400">
            {PERIOD_LABELS[period]} нийт орлого
          </p>
          <p className="mt-1 text-5xl font-bold tracking-tight text-white">
            {totalRevenue.toLocaleString()}
            <span className="ml-2 text-2xl font-medium text-gray-400">₮</span>
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {periodEntries.length.toLocaleString()} амжилттай гүйлгээ
          </p>

          {/* Bar Chart for 7d / 30d */}
          {buckets && (
            <div className="mt-6 flex h-20 items-end gap-1">
              {Object.entries(buckets).map(([k, v]) => (
                <div key={k} className="group relative flex-1">
                  <div
                    className="w-full rounded-t-sm bg-white/20 transition-colors duration-200 group-hover:bg-white/50"
                    style={{
                      height: `${maxBucket ? clamp((v / maxBucket) * 100, 2, 100) : 2}%`,
                    }}
                  />
                  <div className="absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-1 text-xs font-medium text-gray-900 shadow group-hover:block z-10">
                    {v.toLocaleString()}₮
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 1y / all: simple breakdown */}
          {!buckets && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {rows.slice(0, 4).map((r) => (
                <div key={r.courseId} className="rounded-xl bg-white/10 p-3">
                  <p className="truncate text-xs text-gray-400">{r.title}</p>
                  <p className="mt-1 text-sm font-bold text-white">{r.revenue.toLocaleString()}₮</p>
                  <p className="text-xs text-gray-400">{r.soldCount} борлуулалт</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <dt className="truncate text-sm font-medium text-gray-500">Нийт хэрэглэгч</dt>
            <dd className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {usersCount.toLocaleString()}
            </dd>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <dt className="truncate text-sm font-medium text-gray-500">Нийт курс</dt>
            <dd className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {coursesCount.toLocaleString()}
            </dd>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <dt className="truncate text-sm font-medium text-gray-500">Нийт орлого (бүх цаг)</dt>
            <dd className="mt-2 text-3xl font-bold tracking-tight text-indigo-600">
              {allTimeRevenue.toLocaleString()}₮
            </dd>
            <p className="mt-1 text-xs text-gray-400">Идэвхтэй дансны бичиг</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <dt className="truncate text-sm font-medium text-gray-500">Нийт борлуулалт</dt>
            <dd className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {allTimeCount.toLocaleString()}
            </dd>
            <p className="mt-1 text-xs text-gray-400">Бүх гүйлгээ</p>
          </div>
        </section>

        {/* Course Table */}
        <section className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Курсийн борлуулалт</h2>
              <p className="text-sm text-gray-500">
                {PERIOD_LABELS[period]} хугацааны мэдээлэл — {rows.length} курс
              </p>
            </div>
            <div className="relative max-w-sm sm:w-80">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Курсийн нэр эсвэл ID..."
                className="block w-full rounded-full border-0 py-2 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="grid grid-cols-12 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <div className="col-span-6">Курс</div>
              <div className="col-span-3 text-right">Зарагдсан</div>
              <div className="col-span-3 text-right">Орлого</div>
            </div>

            <div className="divide-y divide-gray-100">
              {sliced.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500">
                  {qText
                    ? "Таны хайсан илэрц олдсонгүй."
                    : "Сонгосон хугацаанд борлуулалт байхгүй."}
                </div>
              ) : (
                sliced.map((r) => (
                  <div
                    key={r.courseId}
                    className="grid grid-cols-12 items-center px-6 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="col-span-6 flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">{r.title}</span>
                      <span className="mt-0.5 font-mono text-xs text-gray-400">
                        ID: {r.courseId}
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-800">
                        {r.soldCount}
                      </span>
                    </div>
                    <div className="col-span-3 text-right text-sm font-bold text-indigo-600">
                      {r.revenue.toLocaleString()}₮
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between px-2">
            <p className="text-sm text-gray-500">
              Нийт{" "}
              <span className="font-semibold text-gray-900">{filtered.length}</span> курс •
              Хуудас{" "}
              <span className="font-semibold text-gray-900">{pageSafe}</span> / {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                Өмнөх
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={pageSafe >= pageCount}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                Дараах
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
