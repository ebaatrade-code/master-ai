"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

  durationLabel?: string | null;
  durationDays?: number | null;

  createdAt?: any;
  paidAt?: any;
  qpay?: any;
};

type PurchasedCourseRow = {
  courseId: string;
  title: string;
  thumbUrl: string | null;

  purchasedAt?: any; // Timestamp | number | string
  expiresAt?: any; // Timestamp | number | string

  amount?: number;
  durationLabel?: string | null;
  durationDays?: number | null;
};

function money(n?: number) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString("mn-MN") + "₮" : "0₮";
}

function toDateSafe(ts: any): Date | null {
  try {
    if (!ts) return null;
    if (ts instanceof Timestamp) return ts.toDate();
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts === "number") {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof ts === "string") {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (ts?.seconds != null && ts?.nanoseconds != null) {
      const ms = ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function fmt(ts: any) {
  const d = toDateSafe(ts);
  if (!d) return "—";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ✅ expire огноог тусад нь харагдах хэлбэрээр (өдөр/цагтай)
function fmtExpire(ts: any) {
  const d = toDateSafe(ts);
  if (!d) return "—";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badge(status?: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "PAID") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (s === "PENDING") return "bg-amber-500/15 text-amber-200 border-amber-500/25";
  if (s === "CANCELLED") return "bg-white/10 text-white/60 border-white/15";
  if (s === "EXPIRED") return "bg-white/10 text-white/60 border-white/15";
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

function durationText(durationLabel?: string | null, durationDays?: number | null) {
  const lbl = String(durationLabel ?? "").trim();
  if (lbl) return lbl;
  const dd = Number(durationDays ?? 0);
  if (Number.isFinite(dd) && dd > 0) return `${dd} хоногоор`;
  return "—";
}

// ✅ expiresAt байхгүй үед purchasedAt + durationDays-аар автоматаар тооцно
function computeExpiresAt(purchasedAt: any, expiresAt: any, durationDays?: number | null) {
  const ex = toDateSafe(expiresAt);
  if (ex) return ex;

  const p = toDateSafe(purchasedAt);
  const dd = Number(durationDays ?? 0);

  if (p && Number.isFinite(dd) && dd > 0) {
    const ms = p.getTime() + dd * 24 * 60 * 60 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// ✅ expired эсэхийг "тооцоолсон expires" дээр тулгуурлана
function isExpiredBy(purchasedAt: any, expiresAt: any, durationDays?: number | null) {
  const ex = computeExpiresAt(purchasedAt, expiresAt, durationDays);
  if (!ex) return false; // огт тооцоолж болохгүй бол "дуусаагүй" гэж үзье
  return ex.getTime() <= Date.now();
}

export default function PurchasesPage() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [purchased, setPurchased] = useState<PurchasedCourseRow[]>([]);
  const [pErr, setPErr] = useState<string | null>(null);

  // =========================
  // 1) Invoices (history)
  // =========================
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

  // =========================
  // 2) Purchased courses (from user.purchases map)
  // =========================
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    let alive = true;
    setPErr(null);

    (async () => {
      try {
        const uref = doc(db, "users", user.uid);
        const usnap = await getDoc(uref);
        if (!alive) return;

        const u = usnap.exists() ? (usnap.data() as any) : {};
        const purchasesMap = u?.purchases && typeof u.purchases === "object" ? u.purchases : {};
        const courseIds = Object.keys(purchasesMap);

        if (!courseIds.length) {
          setPurchased([]);
          return;
        }

        const courseDocs = await Promise.all(
          courseIds.map(async (cid) => {
            try {
              const csnap = await getDoc(doc(db, "courses", cid));
              const c = csnap.exists() ? (csnap.data() as any) : null;
              return { courseId: cid, course: c };
            } catch {
              return { courseId: cid, course: null as any };
            }
          })
        );

        const merged: PurchasedCourseRow[] = courseIds.map((cid) => {
          const p = purchasesMap?.[cid] || {};
          const c = courseDocs.find((x) => x.courseId === cid)?.course;

          const title =
            String(c?.title || "").trim() ||
            String(p?.courseTitle || "").trim() ||
            `Course: ${cid}`;

          const thumbUrl =
            (typeof c?.thumbnailUrl === "string" && c.thumbnailUrl.trim())
              ? c.thumbnailUrl.trim()
              : (typeof c?.thumbUrl === "string" && c.thumbUrl.trim())
              ? c.thumbUrl.trim()
              : (typeof p?.courseThumbUrl === "string" && p.courseThumbUrl.trim())
              ? p.courseThumbUrl.trim()
              : null;

          return {
            courseId: cid,
            title,
            thumbUrl,
            purchasedAt: p?.purchasedAt,
            expiresAt: p?.expiresAt,
            amount: Number(p?.amount ?? 0) || undefined,
            durationLabel: (p?.durationLabel ?? null) as any,
            durationDays: (p?.durationDays ?? null) as any,
          };
        });

        // newest first
        merged.sort((a, b) => {
          const da = toDateSafe(a.purchasedAt)?.getTime() ?? 0;
          const dbb = toDateSafe(b.purchasedAt)?.getTime() ?? 0;
          return dbb - da;
        });

        setPurchased(merged);
      } catch (e: any) {
        setPErr(typeof e?.message === "string" ? e.message : "Алдаа гарлаа");
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid, loading]);

  // =========================
  // Derived lists
  // =========================
  // ✅ “Худалдан авалтын түүх” дотор PAID-г харуулахгүй
  const historyRows = useMemo(() => {
    return rows.filter((r) => String(r.status ?? "").toUpperCase() !== "PAID");
  }, [rows]);

  const pendingCount = useMemo(() => {
    return historyRows.filter((r) => String(r.status).toUpperCase() === "PENDING").length;
  }, [historyRows]);

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
          </div>

          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              {pendingCount} хүлээгдэж байна
            </div>
          )}
        </div>

        {/* =========================================================
            1) History (PAID биш зүйлс)
        ========================================================= */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {err && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white/85">
              Худалдан авалтын түүх
            </div>
            <div className="text-xs text-white/45">
              {historyRows.length ? `${historyRows.length} бичлэг` : ""}
            </div>
          </div>

          {historyRows.length === 0 ? (
            <div className="py-8 text-center text-white/60">
              Одоогоор худалдан авалтын түүх байхгүй байна.
            </div>
          ) : (
            <div className="space-y-3">
              {historyRows.map((r) => {
                const st = String(r.status ?? "").toUpperCase();
                const canContinue = st === "PENDING";

                // ✅ Pending үед он сар биш "хугацаа" харуулна
                const metaText =
                  st === "PENDING"
                    ? durationText(r.durationLabel ?? null, r.durationDays ?? null)
                    : fmt(r.createdAt);

                const thumb = (r.courseThumbUrl || "").trim();
                const hasThumb = Boolean(thumb);

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="shrink-0">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/10">
                            {hasThumb ? (
                              <Image
                                src={thumb}
                                alt={r.courseTitle || "Course"}
                                width={44}
                                height={44}
                                className="h-11 w-11 object-cover"
                              />
                            ) : (
                              <div className="h-11 w-11" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[15px] sm:text-[16px] font-bold text-white/90">
                            {r.courseTitle?.trim() ||
                              (r.courseId ? `Course: ${r.courseId}` : "—")}
                          </div>

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

                          <div className="mt-1 text-xs text-white/55">
                            {metaText}
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
                        ) : (
                          <div className="mt-2 text-xs text-white/45">—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =========================================================
            2) Purchased Courses (user.purchases)
        ========================================================= */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {pErr && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {pErr}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white/85">
              Худалдаж авсан хичээлүүд
            </div>
            <div className="text-xs text-white/45">
              {purchased.length ? `${purchased.length} хичээл` : ""}
            </div>
          </div>

          {purchased.length === 0 ? (
            <div className="py-8 text-center text-white/60">
              Одоогоор худалдаж авсан хичээл алга байна.
            </div>
          ) : (
            <div className="space-y-3">
              {purchased.map((c) => {
                const ex = computeExpiresAt(c.purchasedAt, c.expiresAt, c.durationDays ?? null);
                const expired = isExpiredBy(c.purchasedAt, c.expiresAt, c.durationDays ?? null);
                const dur = durationText(c.durationLabel ?? null, c.durationDays ?? null);

                return (
                  <div
                    key={c.courseId}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="shrink-0">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/10">
                            {c.thumbUrl ? (
                              <Image
                                src={c.thumbUrl}
                                alt={c.title}
                                width={44}
                                height={44}
                                className="h-11 w-11 object-cover"
                              />
                            ) : (
                              <div className="h-11 w-11" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[15px] sm:text-[16px] font-bold text-white/90">
                            {c.title}
                          </div>

                          <div className="mt-1 text-xs text-white/55">
                            Нээсэн цаг: {fmt(c.purchasedAt)}
                          </div>

                          <div className="mt-1 text-xs text-white/40">
                            {dur}
                          </div>

                          {/* ✅ expired үед дууссан огноог тодорхой харуулна */}
                          {expired && (
                            <div className="mt-1 text-xs text-white/45">
                              Дууссан огноо: {ex ? fmtExpire(ex) : "—"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {expired ? (
                          <span className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/70">
                            Хугацаа дууссан
                          </span>
                        ) : (
                          <Link
                            href={`/course/${c.courseId}`}
                            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 transition"
                          >
                            Сургалт руу очих
                          </Link>
                        )}
                      </div>
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