"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";

type InvoiceRow = {
  id: string;
  uid: string;
  courseId?: string;
  courseTitle?: string;
  courseThumbUrl?: string | null;
  amount?: number;
  status?: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | string;
  createdAt?: any;
  paidAt?: any;
  updatedAt?: any;
  qpay?: any;
};

type UserPurchase = {
  purchasedAt?: any;
  expiresAt?: any;
  durationDays?: number;
  durationLabel?: string;
  amount?: number;
  invoiceRef?: string;
  qpayInvoiceId?: string;
};

type CourseInfo = {
  id: string;
  title?: string;
  thumbnailUrl?: string | null;
};

function money(n?: number) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString("mn-MN") + "₮" : "0₮";
}

function fmt(ts: any) {
  try {
    const d =
      ts instanceof Timestamp
        ? ts.toDate()
        : ts?.toDate
        ? ts.toDate()
        : ts
        ? new Date(ts)
        : null;
    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function badge(status?: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "PAID")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "PENDING")
    return "bg-amber-500/15 text-amber-200 border-amber-500/25";
  return "bg-white/10 text-white/70 border-white/15";
}

function label(status?: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "PAID") return "Төлөгдсөн";
  if (s === "PENDING") return "Төлбөр хүлээгдэж байна";
  if (s === "CANCELLED") return "Цуцлагдсан";
  if (s === "EXPIRED") return "Хугацаа дууссан";
  return status ?? "Тодорхойгүй";
}

export default function PurchasesPage() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Purchased courses section (from users/{uid}.purchases)
  const [purchased, setPurchased] = useState<
    Array<{ courseId: string; purchasedAt?: any; meta?: UserPurchase }>
  >([]);
  const [courseMap, setCourseMap] = useState<Record<string, CourseInfo>>({});

  // 1) Listen invoices (history)
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    setErr(null);

    const q = query(
      collection(db, "invoices"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: InvoiceRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRows(items);
      },
      (e) => setErr(e.message || "Алдаа гарлаа")
    );

    return () => unsub();
  }, [user?.uid, loading]);

  // 2) Listen user purchases map
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any;
        const purchases: Record<string, UserPurchase> = data?.purchases || {};

        const list = Object.entries(purchases).map(([courseId, meta]) => ({
          courseId,
          purchasedAt: (meta as any)?.purchasedAt,
          meta,
        }));

        // sort desc by purchasedAt
        list.sort((a, b) => {
          const aMs =
            a.purchasedAt instanceof Timestamp
              ? a.purchasedAt.toMillis()
              : a.purchasedAt?.toDate
              ? a.purchasedAt.toDate().getTime()
              : a.purchasedAt
              ? new Date(a.purchasedAt).getTime()
              : 0;

          const bMs =
            b.purchasedAt instanceof Timestamp
              ? b.purchasedAt.toMillis()
              : b.purchasedAt?.toDate
              ? b.purchasedAt.toDate().getTime()
              : b.purchasedAt
              ? new Date(b.purchasedAt).getTime()
              : 0;

          return bMs - aMs;
        });

        setPurchased(list);
      },
      (e) => {
        console.warn("[purchases user doc] error:", e);
      }
    );

    return () => unsub();
  }, [user?.uid, loading]);

  // 3) Fetch course info for purchased list (title + thumbnail)
  useEffect(() => {
    if (!user?.uid) return;
    if (!purchased.length) return;

    let cancelled = false;

    const load = async () => {
      const missing = purchased
        .map((p) => p.courseId)
        .filter((id) => id && !courseMap[id]);

      if (!missing.length) return;

      const next: Record<string, CourseInfo> = {};
      await Promise.all(
        missing.map(async (courseId) => {
          try {
            const cs = await getDoc(doc(db, "courses", courseId));
            if (!cs.exists()) {
              next[courseId] = { id: courseId, title: `Course: ${courseId}` };
              return;
            }
            const c = cs.data() as any;
            next[courseId] = {
              id: courseId,
              title: String(c?.title || "").trim() || `Course: ${courseId}`,
              thumbnailUrl: (c?.thumbnailUrl as string) || null,
            };
          } catch {
            next[courseId] = { id: courseId, title: `Course: ${courseId}` };
          }
        })
      );

      if (cancelled) return;
      setCourseMap((prev) => ({ ...prev, ...next }));
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchased]);

  // ✅ ONLY pending rows shown in "history"
  const pendingRows = useMemo(() => {
    return rows.filter((r) => String(r.status ?? "").toUpperCase() === "PENDING");
  }, [rows]);

  const pendingCount = useMemo(() => pendingRows.length, [pendingRows]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-6 text-white/80">
        Уншиж байна...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-6 text-white/80">
        Нэвтэрсний дараа худалдан авалтын түүх харагдана.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 pb-14">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Худалдан авалтын түүх
            </h1>
            {/* ✅ removed the subtitle line per request */}
          </div>

          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              {pendingCount} хүлээгдэж байна
            </div>
          )}
        </div>

        {/* ======================================================
            ✅ 1) PENDING HISTORY (TOP) — ONLY PENDING
        ====================================================== */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {/* ✅ removed "(төлөгдөөгүй)" label */}
          <div className="text-sm font-semibold text-white/90">
            Худалдан авалтын түүх
          </div>

          {err && (
            <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {pendingRows.length === 0 ? (
            <div className="py-8 text-center text-white/60">
              Одоогоор хүлээгдэж буй төлбөр байхгүй байна.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {pendingRows.map((r) => {
                const st = String(r.status ?? "").toUpperCase();
                const canContinue = st === "PENDING";

                const thumb = (r.courseThumbUrl || "").trim();
                const title =
                  (r.courseTitle || "").trim() ||
                  (r.courseId ? `Course: ${r.courseId}` : "Course");

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex gap-3">
                        {/* thumbnail */}
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/10 shrink-0">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={title}
                              width={48}
                              height={48}
                              className="h-12 w-12 object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          {/* ✅ TITLE BIG TOP */}
                          <div className="truncate text-[15px] sm:text-[16px] font-extrabold text-white/95">
                            {title}
                          </div>

                          {/* ✅ under title: #ID + status badge */}
                          <div className="mt-1 flex items-center gap-2">
                            <div className="text-xs text-white/55">
                              #{r.id.slice(0, 8).toUpperCase()}
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${badge(
                                r.status
                              )}`}
                            >
                              {label(r.status)}
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-white/45">
                            {fmt(r.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold">{money(r.amount)}</div>

                        {canContinue ? (
                          <Link
                            href={`/pay/${r.id}`}
                            className="mt-2 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 transition"
                          >
                            Төлбөр үргэлжлүүлэх
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ✅ removed the bottom helper text per request */}
        </div>

        {/* ======================================================
            ✅ 2) PURCHASED COURSES (BOTTOM)
        ====================================================== */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white/90">
              Худалдаж авсан хичээлүүд
            </div>
            <div className="text-xs text-white/50">
              {purchased.length ? `${purchased.length} хичээл` : "—"}
            </div>
          </div>

          {purchased.length === 0 ? (
            <div className="py-8 text-center text-white/60">
              Одоогоор худалдан авсан хичээл байхгүй байна.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {purchased.map((p) => {
                const info = courseMap[p.courseId];
                const title =
                  (info?.title || "").trim() || `Course: ${p.courseId}`;
                const thumb = (info?.thumbnailUrl || "").trim();

                return (
                  <div
                    key={p.courseId}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/10 shrink-0">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={title}
                              width={48}
                              height={48}
                              className="h-12 w-12 object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white/90">
                            {title}
                          </div>
                          <div className="mt-1 text-xs text-white/55">
                            Нээсэн цаг: {fmt(p.purchasedAt)}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/course/${p.courseId}`}
                        className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 transition shrink-0"
                      >
                        Сургалт руу очих
                      </Link>
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