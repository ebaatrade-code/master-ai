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

  // ✅ MOBILE: PENDING text black
  // ✅ DESKTOP: хэвээр (sm:text-amber-200)
  if (s === "PENDING")
    return "bg-amber-500/15 text-black border-amber-500/25 sm:text-amber-200";

  if (s === "PAID") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
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
  if (Number.isFinite(dd) && dd > 0) return `${dd} хоног`;
  return "—";
}

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

function isExpiredBy(purchasedAt: any, expiresAt: any, durationDays?: number | null) {
  const ex = computeExpiresAt(purchasedAt, expiresAt, durationDays);
  if (!ex) return false;
  return ex.getTime() <= Date.now();
}

export default function PurchasesPage() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [purchased, setPurchased] = useState<PurchasedCourseRow[]>([]);
  const [pErr, setPErr] = useState<string | null>(null);

  // ✅ Course existence cache (to hide deleted courses in history & purchases)
  // key = courseId, value = true/false
  const [courseExists, setCourseExists] = useState<Record<string, boolean>>({});

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

  // ✅ When rows change: fetch course existence for rows that have courseId
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (!rows.length) return;

    let alive = true;

    (async () => {
      try {
        const ids = Array.from(
          new Set(
            rows
              .map((r) => String(r.courseId || "").trim())
              .filter(Boolean)
          )
        );

        if (!ids.length) return;

        // Only check ids we haven't checked yet
        const missing = ids.filter((cid) => courseExists[cid] === undefined);
        if (!missing.length) return;

        const checks = await Promise.all(
          missing.map(async (cid) => {
            try {
              const csnap = await getDoc(doc(db, "courses", cid));
              return { cid, exists: csnap.exists() };
            } catch {
              // If read fails, don't hide it aggressively; mark as true (safe)
              return { cid, exists: true };
            }
          })
        );

        if (!alive) return;

        setCourseExists((prev) => {
          const next = { ...prev };
          for (const c of checks) next[c.cid] = c.exists;
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, user?.uid, loading]); // intentionally not depending on courseExists to avoid loops

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
              const exists = csnap.exists();
              const c = exists ? (csnap.data() as any) : null;
              return { courseId: cid, course: c, exists };
            } catch {
              // If read fails, don't hide it aggressively
              return { courseId: cid, course: null as any, exists: true };
            }
          })
        );

        // ✅ update courseExists cache too
        if (alive) {
          setCourseExists((prev) => {
            const next = { ...prev };
            for (const cd of courseDocs) {
              // only set if not already known
              if (next[cd.courseId] === undefined && typeof cd.exists === "boolean") {
                next[cd.courseId] = cd.exists;
              }
            }
            return next;
          });
        }

        // ✅ HIDE deleted courses: only keep exists===true
        const merged: PurchasedCourseRow[] = courseDocs
          .filter((x) => x.exists === true)
          .map((x) => {
            const cid = x.courseId;
            const p = purchasesMap?.[cid] || {};
            const c = x.course;

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

  const historyRows = useMemo(() => {
    return rows
      // ✅ PAID-г гаргахгүй (хуучин логик)
      .filter((r) => String(r.status ?? "").toUpperCase() !== "PAID")
      // ✅ ARCHIVED-г огт харуулахгүй
      .filter((r) => String(r.status ?? "").toUpperCase() !== "ARCHIVED")
      // ✅ course устсан бол харуулахгүй (courseId байвал шалгана)
      .filter((r) => {
        const cid = String(r.courseId || "").trim();
        if (!cid) return true; // courseId байхгүй бол нуухгүй
        const ex = courseExists[cid];
        if (ex === false) return false; // deleted -> hide
        return true; // unknown/true -> show
      });
  }, [rows, courseExists]);

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

  const mobileText = "text-black sm:text-white";

  return (
    <div className={`min-h-[calc(100vh-80px)] ${mobileText}`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 pb-14">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-[1.05] font-black tracking-tight sm:text-2xl sm:font-extrabold sm:tracking-tight">
              Худалдан авалтын түүх
            </h1>
          </div>

          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 sm:border-amber-500/25 sm:bg-amber-500/10 sm:text-amber-200">
              {pendingCount} хүлээгдэж байна
            </div>
          )}
        </div>

        {/* =========================
            1) History (PAID биш зүйлс)
        ========================= */}
        <div
          className="
            mt-5
            bg-transparent border-0 p-0 rounded-none
            sm:rounded-2xl sm:border sm:border-white/10 sm:bg-black/20 sm:p-4
          "
        >
          {err && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-black/90 sm:text-white/85">
              Худалдан авалтын түүх
            </div>
            <div className="text-xs text-black/60 sm:text-white/45">
              {historyRows.length ? `${historyRows.length} бичлэг` : ""}
            </div>
          </div>

          {historyRows.length === 0 ? (
            <div className="py-8 text-center text-black/70 sm:text-white/60">
              Одоогоор худалдан авалтын түүх байхгүй байна.
            </div>
          ) : (
            <div className="space-y-3">
              {historyRows.map((r) => {
                const st = String(r.status ?? "").toUpperCase();
                const canContinue = st === "PENDING";

                const thumb = (r.courseThumbUrl || "").trim();
                const hasThumb = Boolean(thumb);

                const dur = durationText(r.durationLabel ?? null, r.durationDays ?? null);

                return (
                  <div
                    key={r.id}
                    className="
                      rounded-2xl
                      border border-black/15 bg-white/70
                      p-4
                      sm:border-white/10 sm:bg-white/5
                    "
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="shrink-0">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-black/5 sm:bg-white/10">
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
                          <div className="truncate text-[15px] font-bold text-black sm:text-[16px] sm:font-bold sm:text-white/90">
                            {r.courseTitle?.trim() ||
                              (r.courseId ? `Course: ${r.courseId}` : "—")}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <div className="text-[11px] font-medium text-black/70 sm:text-xs sm:text-white/55">
                              #{r.id.slice(0, 8).toUpperCase()}
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full border
                                px-2 py-[2px] leading-none text-[11px]
                                sm:px-2 sm:py-0.5 sm:leading-normal sm:text-[11px]
                                ${badge(r.status)}`}
                            >
                              {label(r.status)}
                            </span>
                          </div>

                          {/* ✅ Desktop дээр хуучин meta хэвээр */}
                          <div className="mt-1 hidden text-xs text-white/55 sm:block">
                            {st === "PENDING" ? dur : fmt(r.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right sm:shrink-0">
                        {/* ✅ Desktop дээр үнэ хуучнаараа */}
                        <div className="hidden text-sm font-bold text-white sm:block">
                          {money(r.amount)}
                        </div>

                        {/* ✅ MOBILE: “45 хоног / 100₮” — хугацаа бүдэг, үнэ тод */}
                        <div className="mt-2 flex items-center justify-center gap-2 sm:hidden">
                          <span className="text-[16px] font-semibold text-black/45">
                            {dur}
                          </span>
                          <span className="text-[14px] font-semibold text-black/25">/</span>
                          <span className="text-[18px] leading-none font-black text-black">
                            {money(r.amount)}
                          </span>
                        </div>

                        {/* ✅ MOBILE: “Худалдан авах” шиг blue gradient + stroke + white text */}
                        {canContinue ? (
                          <Link
                            href={`/pay/${r.id}`}
                            className="
                              mt-3
                              inline-flex w-full items-center justify-center
                              rounded-2xl
                              border border-blue-600/60
                              bg-gradient-to-r from-cyan-500 to-blue-600
                              px-4 py-3 text-[13px] font-extrabold text-white
                              shadow-[0_10px_28px_rgba(37,99,235,0.25)]
                              active:scale-[0.99]
                              transition
                              sm:mt-2 sm:w-auto sm:rounded-xl sm:border-white/15 sm:bg-white/10 sm:px-3 sm:py-2 sm:text-xs sm:font-semibold sm:text-white sm:shadow-none sm:active:scale-100
                            "
                          >
                            Төлбөр үргэлжлүүлэх
                          </Link>
                        ) : (
                          <div className="mt-3 text-center text-xs font-medium text-black/50 sm:mt-2 sm:text-right sm:text-white/45">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =========================
            2) Purchased Courses (user.purchases)
        ========================= */}
        <div
          className="
            mt-6
            bg-transparent border-0 p-0 rounded-none
            sm:rounded-2xl sm:border sm:border-white/10 sm:bg-black/20 sm:p-4
          "
        >
          {pErr && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {pErr}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-black/90 sm:text-white/85">
              Худалдаж авсан хичээлүүд
            </div>
            <div className="text-xs text-black/60 sm:text-white/45">
              {purchased.length ? `${purchased.length} хичээл` : ""}
            </div>
          </div>

          {purchased.length === 0 ? (
            <div className="py-8 text-center text-black/70 sm:text-white/60">
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
                    className="
                      rounded-2xl
                      border border-black/15 bg-white/70
                      p-4
                      sm:border-white/10 sm:bg-white/5
                    "
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="shrink-0">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-black/5 sm:bg-white/10">
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
                          <div className="truncate text-[15px] font-bold text-black sm:text-[16px] sm:font-bold sm:text-white/90">
                            {c.title}
                          </div>

                          <div className="mt-1 text-[12px] font-medium text-black/70 sm:text-xs sm:text-white/55">
                            Нээсэн цаг: {fmt(c.purchasedAt)}
                          </div>

                          <div className="mt-1 text-[12px] font-medium text-black/55 sm:text-xs sm:text-white/40">
                            {dur}
                          </div>

                          {expired && (
                            <div className="mt-1 text-[12px] font-medium text-black/60 sm:text-xs sm:text-white/45">
                              Дууссан огноо: {ex ? fmtExpire(ex) : "—"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end sm:text-right sm:shrink-0">
                        {expired ? (
                          <span className="inline-flex items-center rounded-xl border border-black/15 bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 sm:border-white/15 sm:bg-white/10 sm:text-white/70">
                            Хугацаа дууссан
                          </span>
                        ) : (
                          <Link
                            href={`/course/${c.courseId}`}
                            className="
                              inline-flex items-center justify-center
                              rounded-xl border border-black/20 bg-black/5
                              px-3 py-2 text-[12px] font-semibold text-black
                              hover:bg-black/10 transition
                              sm:border-white/15 sm:bg-white/10 sm:text-xs sm:text-white
                            "
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