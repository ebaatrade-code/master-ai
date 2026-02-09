"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "firebase/firestore";

type InvoiceRow = {
  id: string;
  uid: string;
  courseId?: string;
  courseTitle?: string;
  amount?: number;
  status?: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | string;
  createdAt?: any;
  paidAt?: any;
  qpay?: any;
};

function money(n?: number) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString("mn-MN") + "₮" : "0₮";
}

function fmt(ts: any) {
  try {
    const d =
      ts instanceof Timestamp ? ts.toDate() :
      ts?.toDate ? ts.toDate() :
      ts ? new Date(ts) : null;
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

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    setErr(null);

    // ✅ invoices collection-оос уншина (Pending/PAID бүгд энд харагдана)
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

  const pendingCount = useMemo(
    () => rows.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
    [rows]
  );

  if (loading) {
    return <div className="min-h-[calc(100vh-80px)] p-6 text-white/80">Уншиж байна...</div>;
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
            <p className="mt-1 text-sm text-white/60">
              Төлбөрийн төлөв, огноо, дүн — бүгд энд хадгалагдана.
            </p>
          </div>

          {pendingCount > 0 && (
            <div className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              {pendingCount} хүлээгдэж байна
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {err && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="py-10 text-center text-white/60">
              Одоогоор худалдан авалтын түүх байхгүй байна.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const st = String(r.status ?? "").toUpperCase();
                const canContinue = st === "PENDING";

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">
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
                          {fmt(r.createdAt)}
                        </div>

                        {(r.courseTitle || r.courseId) && (
                          <div className="mt-2 text-sm text-white/85 truncate">
                            {r.courseTitle ?? `Course: ${r.courseId}`}
                          </div>
                        )}
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
                          <Link
                            href={`/course/${r.courseId ?? ""}`}
                            className="mt-2 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/15 transition"
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

        <div className="mt-4 text-xs text-white/45">
          * “Төлбөр үргэлжлүүлэх” дээр дарвал QR / банк сонголттой төлбөрийн дэлгэц рүү орно.
        </div>
      </div>
    </div>
  );
}