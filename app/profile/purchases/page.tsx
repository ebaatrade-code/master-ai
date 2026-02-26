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

function badge(status?: string) {
  const s = (status ?? "").toUpperCase();

  // ✅ PENDING -> mobile black text, desktop remains readable
  if (s === "PENDING")
    return "bg-amber-500/15 text-black border-amber-500/35 sm:text-amber-800";

  if (s === "PAID") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/35";
  if (s === "CANCELLED") return "bg-black/5 text-black/60 border-black/20";
  if (s === "EXPIRED") return "bg-black/5 text-black/60 border-black/20";
  return "bg-black/5 text-black/70 border-black/20";
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

export default function PurchasesPage() {
  const { user, loading } = useAuth();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Course existence cache (to hide deleted courses in history)
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

        const missing = ids.filter((cid) => courseExists[cid] === undefined);
        if (!missing.length) return;

        const checks = await Promise.all(
          missing.map(async (cid) => {
            try {
              const csnap = await getDoc(doc(db, "courses", cid));
              return { cid, exists: csnap.exists() };
            } catch {
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
  }, [rows, user?.uid, loading]);

  const historyRows = useMemo(() => {
    return rows
      .filter((r) => String(r.status ?? "").toUpperCase() !== "PAID")
      .filter((r) => String(r.status ?? "").toUpperCase() !== "ARCHIVED")
      .filter((r) => {
        const cid = String(r.courseId || "").trim();
        if (!cid) return true;
        const ex = courseExists[cid];
        if (ex === false) return false;
        return true;
      });
  }, [rows, courseExists]);

  const pendingCount = useMemo(() => {
    return historyRows.filter((r) => String(r.status).toUpperCase() === "PENDING").length;
  }, [historyRows]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-6 text-black/70">
        Уншиж байна...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-6 text-black/70">
        Нэвтэрсний дараа худалдан авалтын түүх харагдана.
      </div>
    );
  }

  return (
    <div className="purchase-history-page min-h-[calc(100vh-80px)] text-black">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 pb-14">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-[1.05] font-black tracking-tight sm:text-2xl sm:font-extrabold sm:tracking-tight">
              Худалдан авалтын түүх
            </h1>
          </div>

          {pendingCount > 0 && (
            <div className="rounded-full border-2 border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800">
              {pendingCount} хүлээгдэж байна
            </div>
          )}
        </div>

        <div className="mt-5 bg-transparent border-0 p-0 rounded-none">
          {err && (
            <div className="mb-3 rounded-xl border-2 border-red-500/30 bg-red-500/10 p-3 text-sm text-red-900">
              {err}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-extrabold text-black">
              Худалдан авалтын түүх
            </div>
            <div className="text-xs text-black/55">
              {historyRows.length ? `${historyRows.length} бичлэг` : ""}
            </div>
          </div>

          {historyRows.length === 0 ? (
            <div className="py-8 text-center text-black/60">
              Одоогоор худалдан авалтын түүх байхгүй байна.
            </div>
          ) : (
            <div>
              {historyRows.map((r, idx) => {
                const st = String(r.status ?? "").toUpperCase();
                const canContinue = st === "PENDING";

                const thumb = (r.courseThumbUrl || "").trim();
                const hasThumb = Boolean(thumb);

                const dur = durationText(r.durationLabel ?? null, r.durationDays ?? null);

                return (
                  <div key={r.id}>
                    <div
                      className="
                        rounded-2xl
                        border border-black/15 bg-white/70
                        p-6 min-h-[110px]
                        sm:border-white/10 sm:bg-white/5 sm:min-h-[120px]
                      "
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <div className="shrink-0">
                            <div className="h-11 w-11 overflow-hidden rounded-xl border-2 border-black/10 bg-white">
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
                            <div className="truncate text-[15px] font-extrabold text-black sm:text-[16px]">
                              {r.courseTitle?.trim() ||
                                (r.courseId ? `Course: ${r.courseId}` : "—")}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <div className="text-[11px] font-semibold text-black/60">
                                #{r.id.slice(0, 8).toUpperCase()}
                              </div>

                              <span
                                className={`inline-flex items-center rounded-full border-2
                                  px-2 py-[2px] leading-none text-[11px]
                                  ${badge(r.status)}`}
                              >
                                {label(r.status)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="sm:text-right sm:shrink-0">
                          {/* ✅ Desktop дээр үнэ том/тод */}
                          <div className="hidden text-sm sm:text-[18px] font-black tracking-tight text-black sm:block">
  <span className="text-black/45 font-semibold">
    {dur}
  </span>
  <span className="mx-1 text-black/30 font-semibold">/</span>
  <span>
    {money(r.amount)}
  </span>
</div>

                          {/* ✅ MOBILE: “хоног / үнэ” мөр ХЭВЭЭР (устгахгүй) */}
                          <div className="mt-2 flex items-center justify-center gap-2 sm:hidden">
                            <span className="text-[16px] font-semibold text-black/45">
                              {dur}
                            </span>
                            <span className="text-[14px] font-semibold text-black/25">/</span>
                            <span className="text-[18px] leading-none font-black text-black">
                              {money(r.amount)}
                            </span>
                          </div>

                          {canContinue ? (
                            <Link
                              href={`/pay/${r.id}`}
                              className="
                                mt-3
                                inline-flex w-full items-center justify-center
                                rounded-2xl
                                border border-black/90 hover:border-black/20
                                bg-gradient-to-r from-cyan-300 to-blue-300
                                px-4 py-3 text-[13px] font-extrabold !text-white
                                shadow-[0_10px_28px_rgba(37,99,235,0.25)]
                                active:scale-[0.99]
                                transition
                                sm:mt-2 sm:w-auto sm:rounded-xl sm:border-2 sm:border-white sm:bg-white/10 sm:px-3 sm:py-2 sm:text-xs sm:font-semibold sm:text-black sm:shadow-none sm:active:scale-100
                              "
                            >
                              Төлбөр үргэлжлүүлэх
                            </Link>
                          ) : (
                            <div className="mt-3 text-center text-xs font-medium text-black/45 sm:mt-2 sm:text-right">
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ✅ Divider: УТСАН дээр харагдахгүй, зөвхөн sm+ дээр харагдана */}
                    {idx < historyRows.length - 1 && (
                      <div className="my-2.5 hidden border-t border-dashed border-black/35 sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ “Худалдаж авсан хичээлүүд” хэсгийг бүр мөсөн устгав */}
      </div>
    </div>
  );
}