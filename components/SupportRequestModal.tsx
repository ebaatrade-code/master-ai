"use client";

import { useEffect, useMemo, useState } from "react";

type SupportRequest = {
  id: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  adminNote?: string | null;
  status?: string | null;
  createdAt?: any;
  handledAt?: any;
  imageUrls?: string[] | null;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function fmtTs(ts: any) {
  try {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
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

export default function SupportRequestModal({
  open,
  onClose,
  item,
  onSaveNote,
  onMarkDone,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  item: SupportRequest | null;
  onSaveNote: (note: string) => Promise<void> | void;
  onMarkDone: () => Promise<void> | void;
  saving?: boolean;
}) {
  const [note, setNote] = useState("");

  const images = useMemo(() => {
    const arr = (item?.imageUrls || []) as any;
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, 3) : [];
  }, [item?.imageUrls]);

  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setNote(item?.adminNote ? String(item.adminNote) : "");
    setPreview(null);
  }, [item?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* overlay */}
      <button
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-3xl bg-white text-black shadow-[0_30px_90px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
            <div className="min-w-0">
              <div className="text-lg font-extrabold">Хүсэлтийн дэлгэрэнгүй</div>
              <div className="mt-1 text-xs text-black/55">
                Огноо: <span className="text-black/80 font-semibold">{fmtTs(item.createdAt)}</span>{" "}
                · ID: <span className="font-mono text-black/70">{item.id}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-black/[0.03]"
            >
              Хаах
            </button>
          </div>

          {/* content */}
          <div className="px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-black/60">Email</span>
                <input
                  value={item.email || "—"}
                  disabled
                  className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-semibold text-black/85"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-black/60">Утас</span>
                <input
                  value={item.phone || "—"}
                  disabled
                  className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-semibold text-black/85"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-1">
              <span className="text-xs font-bold text-black/60">Хүсэлт</span>
              <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-4 text-sm text-black/85 whitespace-pre-wrap">
                {item.message || "—"}
              </div>
            </div>

            {/* ✅ images */}
            <div className="mt-5">
              <div className="text-xs font-bold text-black/60">Хавсаргасан зураг</div>

              {images.length === 0 ? (
                <div className="mt-2 text-sm text-black/50">Зураг хавсаргаагүй</div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {images.map((src, i) => (
                      <button
                        key={src + i}
                        onClick={() => setPreview(src)}
                        className="group relative overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02] hover:bg-black/[0.03]"
                        title="Томоор харах"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`attachment-${i + 1}`}
                          className="h-28 w-full object-cover"
                        />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/10" />
                      </button>
                    ))}
                  </div>

                  {preview && (
                    <div className="mt-4 rounded-3xl border border-black/10 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-extrabold text-black/80">Зураг (том)</div>
                        <button
                          onClick={() => setPreview(null)}
                          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03]"
                        >
                          Хаах
                        </button>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="preview" className="w-full max-h-[420px] object-contain" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* admin note */}
            <div className="mt-6 grid gap-1">
              <span className="text-xs font-bold text-black/60">Admin note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Админ тэмдэглэл..."
              />
            </div>
          </div>

          {/* footer actions */}
          <div className="flex flex-wrap gap-2 border-t border-black/10 px-6 py-5">
            <button
              onClick={() => onSaveNote(note)}
              disabled={!!saving}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-extrabold",
                "bg-black text-white hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              Note хадгалах
            </button>

            <button
              onClick={onMarkDone}
              disabled={!!saving}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-extrabold",
                "bg-white text-black border border-black/15 hover:bg-black/[0.03] disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              Шийдсэн болгох
            </button>

            <div className="ml-auto text-xs text-black/50 self-center">
              Төлөв: <span className="font-semibold text-black/70">{item.status || "—"}</span>
              {item.handledAt ? (
                <>
                  {" "}
                  · handled: <span className="font-semibold text-black/70">{fmtTs(item.handledAt)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}