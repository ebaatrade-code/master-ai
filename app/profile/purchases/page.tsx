"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

type PurchaseMapItem = {
  ref?: string;
  status?: string;
  amount?: number;
  durationDays?: number | null;
  durationLabel?: string | null;
  paidAt?: unknown;
  purchasedAt?: unknown;
  activatedAt?: unknown;
  expiresAt?: unknown;
  courseTitle?: string;
  courseThumbUrl?: string;
};

type CourseLite = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  authorName?: string;
};

type HistoryRow = {
  courseId: string;
  title: string;
  thumbnailUrl: string;
  authorName?: string;
  amount: number;
  paidAt?: unknown;
  expiresAt?: unknown;
  durationDays?: number | null;
  durationLabel?: string | null;
  active: boolean;
};

type UserDocShape = {
  purchasedCourseIds?: unknown[];
  purchases?: Record<string, PurchaseMapItem>;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}


function toDateSafe(value: unknown): Date | null {
  try {
    if (!value) return null;

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      const d = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "seconds" in value &&
      "nanoseconds" in value
    ) {
      const ts = value as { seconds?: unknown; nanoseconds?: unknown };
      const seconds =
        typeof ts.seconds === "number" ? ts.seconds : Number(ts.seconds);
      const nanoseconds =
        typeof ts.nanoseconds === "number"
          ? ts.nanoseconds
          : Number(ts.nanoseconds);

      if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
        const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
      }
    }

    if (typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  } catch {
    return null;
  }
}

function fmtDate(value: unknown) {
  const d = toDateSafe(value);
  if (!d) return "—";

  return d.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toMs(value: unknown): number | null {
  const d = toDateSafe(value);
  if (!d) return null;
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function durationText(durationLabel?: string | null, durationDays?: number | null) {
  const lbl = String(durationLabel ?? "").trim();
  if (lbl) return lbl;

  const dd = Number(durationDays ?? 0);
  if (Number.isFinite(dd) && dd > 0) return `${dd} хоног`;

  return "—";
}

function isExpired(expiresAt: unknown) {
  const ms = toMs(expiresAt);
  if (!ms) return false;
  return Date.now() > ms;
}

function getRemainingDays(expiresAt: unknown): number | null {
  const ms = toMs(expiresAt);
  if (!ms) return null;
  const remaining = ms - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (1000 * 60 * 60 * 24));
}

function getProgressPercent(paidAt: unknown, expiresAt: unknown): number {
  const startMs = toMs(paidAt);
  const endMs = toMs(expiresAt);
  if (!startMs || !endMs || endMs <= startMs) return 0;
  const elapsed = Date.now() - startMs;
  return Math.min(100, Math.max(0, (elapsed / (endMs - startMs)) * 100));
}

function sortRows(rows: HistoryRow[]) {
  const activeRows = rows
    .filter((r) => r.active)
    .sort((a, b) => {
      const aPaid = toMs(a.paidAt) ?? 0;
      const bPaid = toMs(b.paidAt) ?? 0;
      return bPaid - aPaid;
    });

  const expiredRows = rows
    .filter((r) => !r.active)
    .sort((a, b) => {
      const aExp = toMs(a.expiresAt) ?? 0;
      const bExp = toMs(b.expiresAt) ?? 0;
      return bExp - aExp;
    });

  return [...activeRows, ...expiredRows];
}

function getPurchaseDate(purchase?: PurchaseMapItem): unknown {
  return (
    purchase?.paidAt ??
    purchase?.purchasedAt ??
    purchase?.activatedAt ??
    null
  );
}

export default function PurchasesPage() {
  const { user, loading, purchasedCourseIds } = useAuth();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rawIds = useMemo(
    () =>
      Array.isArray(purchasedCourseIds)
        ? purchasedCourseIds
            .map((v) => String(v ?? "").trim())
            .filter((v) => v.length > 0)
        : [],
    [purchasedCourseIds]
  );

  useEffect(() => {
    if (loading) return;

    if (!user?.uid) {
      setRows([]);
      setErr(null);
      return;
    }

    let alive = true;

    const run = async () => {
      setFetching(true);
      setErr(null);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          if (!alive) return;
          setRows([]);
          return;
        }

        const userData = (userSnap.data() as UserDocShape) || {};

        const docPurchasedIds = Array.isArray(userData.purchasedCourseIds)
          ? userData.purchasedCourseIds
              .map((v) => String(v ?? "").trim())
              .filter((v) => v.length > 0)
          : [];

        const purchasesMap: Record<string, PurchaseMapItem> =
          userData.purchases && typeof userData.purchases === "object"
            ? userData.purchases
            : {};

        const mergedIds = Array.from(
          new Set([
            ...rawIds,
            ...docPurchasedIds,
            ...Object.keys(purchasesMap).map((v) => String(v ?? "").trim()),
          ])
        ).filter(Boolean);

        if (mergedIds.length === 0) {
          if (!alive) return;
          setRows([]);
          return;
        }

        const courseDocs: CourseLite[] = [];
        const groups = chunk<string>(mergedIds, 10);

        for (const group of groups) {
          const qy = query(
            collection(db, "courses"),
            where(documentId(), "in", group)
          );
          const snap = await getDocs(qy);

          snap.forEach((d) => {
            const data = d.data() as Omit<CourseLite, "id">;
            courseDocs.push({
              id: d.id,
              title: data.title,
              thumbnailUrl: data.thumbnailUrl,
              authorName: data.authorName,
            });
          });
        }

        const courseMap = new Map<string, CourseLite>();
        for (const course of courseDocs) {
          courseMap.set(course.id, course);
        }

        const nextRows: HistoryRow[] = mergedIds.map((courseId) => {
          const purchase = purchasesMap[courseId] ?? {};
          const course = courseMap.get(courseId);

          const amount = Number(purchase.amount ?? 0);
          const safeAmount = Number.isFinite(amount) ? amount : 0;

          const paidAt = getPurchaseDate(purchase);

          return {
            courseId,
            title: String(
              course?.title ??
                purchase.courseTitle ??
                "Сургалтын нэр олдсонгүй"
            ),
            thumbnailUrl: String(
              course?.thumbnailUrl ??
                purchase.courseThumbUrl ??
                ""
            ).trim(),
            authorName: course?.authorName
              ? String(course.authorName).trim()
              : undefined,
            amount: safeAmount,
            paidAt,
            expiresAt: purchase.expiresAt ?? null,
            durationDays:
              typeof purchase.durationDays === "number"
                ? purchase.durationDays
                : purchase.durationDays != null
                ? Number(purchase.durationDays)
                : null,
            durationLabel:
              purchase.durationLabel != null
                ? String(purchase.durationLabel)
                : null,
            active: !isExpired(purchase.expiresAt),
          };
        });

        if (!alive) return;
        setRows(sortRows(nextRows));
      } catch (e: unknown) {
        if (!alive) return;

        const message =
          e instanceof Error
            ? e.message
            : "Худалдан авалтын түүх унших үед алдаа гарлаа.";

        setErr(message);
        setRows([]);
      } finally {
        if (alive) {
          setFetching(false);
        }
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [user?.uid, loading, rawIds]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.active).length,
    [rows]
  );

  const expiredCount = useMemo(
    () => rows.filter((r) => !r.active).length,
    [rows]
  );

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-gray-50/50 p-6">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <span className="text-sm font-medium">Уншиж байна...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-gray-50/50 p-6">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium text-gray-900">Нэвтрэх шаардлагатай</p>
          <p className="mt-1 text-sm">Нэвтэрсний дараа худалдан авалтын түүх харагдана.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50/30 text-gray-900">
      <div className="mx-auto max-w-4xl px-4 pt-10 pb-16 sm:px-6 sm:pt-12">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-gray-900">
              Худалдан авалтын түүх
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Таны худалдан авсан бүх сургалтуудын жагсаалт.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 border border-green-200/60">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-700">
                Идэвхтэй: {activeCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 border border-gray-200/60">
              <div className="h-2 w-2 rounded-full bg-gray-400" />
              <span className="text-xs font-semibold text-gray-600">
                Дууссан: {expiredCount}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="mt-8">
          {err && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex gap-3">
                <svg className="h-5 w-5 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {err}
              </div>
            </div>
          )}

          {fetching ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[140px] w-full animate-pulse rounded-2xl bg-gray-200/60" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="mb-3 rounded-full bg-gray-50 p-3">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900">Одоогоор хоосон байна</h3>
              <p className="mt-1 text-sm text-gray-500">Та ямар нэгэн хичээл худалдаж аваагүй байна.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((r) => {
                const hasThumb = Boolean(r.thumbnailUrl);
                const dur = durationText(r.durationLabel ?? null, r.durationDays ?? null);
                const remainingDays = getRemainingDays(r.expiresAt);
                const progress = getProgressPercent(r.paidAt, r.expiresAt);

                const actionBtn = r.active ? (
                  <Link
                    href={`/course/${r.courseId}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-gray-700 active:scale-95 sm:px-5 sm:py-2.5"
                  >
                    Үзэх
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                ) : (
                  <div className="inline-flex cursor-not-allowed items-center rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 sm:px-5 sm:py-2.5">
                    Хугацаа дууссан
                  </div>
                );

                return (
                  <div
                    key={r.courseId}
                    className={`relative flex items-start gap-3 overflow-hidden rounded-2xl bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md border-l-4 sm:items-center sm:gap-5 sm:px-5 sm:py-5 ${
                      r.active ? "border-l-green-500" : "border-l-gray-200"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-[80px] sm:w-[80px]">
                      {hasThumb ? (
                        <Image
                          src={r.thumbnailUrl}
                          alt={r.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg className="h-6 w-6 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {/* Title */}
                      <h3 className={`line-clamp-2 text-sm font-bold leading-snug sm:text-base ${r.active ? "text-gray-900" : "text-gray-500"}`}>
                        {r.title}
                      </h3>

                      {/* Mobile: badge + button in same row */}
                      <div className="flex items-center justify-between sm:hidden">
                        {r.active ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-green-700 ring-1 ring-inset ring-green-600/20">
                            ИДЭВХТЭЙ
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-gray-500 ring-1 ring-inset ring-gray-400/20">
                            ДУУССАН
                          </span>
                        )}
                        {actionBtn}
                      </div>

                      {/* Desktop: badge only */}
                      <div className="hidden sm:flex items-center gap-2">
                        {r.active ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-green-700 ring-1 ring-inset ring-green-600/20">
                            ИДЭВХТЭЙ
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-gray-500 ring-1 ring-inset ring-gray-400/20">
                            ДУУССАН
                          </span>
                        )}
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-3 gap-x-2 sm:flex sm:gap-6">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[10px]">Огноо</p>
                          <p className="text-xs font-semibold text-gray-800 sm:text-sm">{fmtDate(r.paidAt)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[10px]">Дуусах</p>
                          <p className="text-xs font-semibold text-gray-800 sm:text-sm">{fmtDate(r.expiresAt)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 sm:text-[10px]">Хугацаа</p>
                          <p className="text-xs font-semibold text-gray-800 sm:text-sm">{dur}</p>
                        </div>
                      </div>

                      {/* Progress bar + remaining label */}
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${r.active ? "bg-green-500" : "bg-gray-300"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-right text-[11px] font-medium text-gray-400">
                          {r.active
                            ? remainingDays === null
                              ? "Эхэлсэн"
                              : remainingDays === 0
                              ? "Өнөөдөр дуусна"
                              : `${remainingDays} хоног үлдсэн`
                            : "Эхэлсэн"}
                        </p>
                      </div>
                    </div>

                    {/* Desktop-only action button */}
                    <div className="hidden shrink-0 sm:block">
                      {actionBtn}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}