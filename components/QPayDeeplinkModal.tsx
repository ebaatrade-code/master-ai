"use client";

import { useEffect, useMemo, useState } from "react";

type Deeplink = { name?: string; description?: string; link: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  urls: Deeplink[];
  onCheck: () => Promise<void>;
  statusText?: string;
};

export default function QPayDeeplinkModal({
  open,
  onClose,
  title,
  amount,
  urls,
  onCheck,
  statusText,
}: Props) {
  const [checking, setChecking] = useState(false);

  const money = useMemo(
    () => (Number.isFinite(amount) ? amount.toLocaleString("mn-MN") : "0"),
    [amount]
  );

  useEffect(() => {
    if (!open) setChecking(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0f] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">Төлбөр төлөх</div>
            <div className="mt-1 text-sm text-white/60">
              {title} • <span className="font-semibold text-white/80">{money}₮</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Хаах
          </button>
        </div>

        <div className="mb-3 text-sm text-white/70">
          Доорх банк/хэтэвчээс сонгоход апп нээгдэж, төлбөрийн мэдээлэл автоматаар бөглөгдөнө.
        </div>

        <div className="grid grid-cols-1 gap-2">
          {urls?.map((u, idx) => (
            <a
              key={idx}
              href={u.link}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
            >
              <div className="text-sm font-semibold text-white">
                {u.description || u.name || "Bank app"}
              </div>
              <div className="text-xs text-white/50 break-all">{u.link}</div>
            </a>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            {statusText || "Төлбөр хийсний дараа “Төлбөр шалгах” дээр дарна."}
          </div>

          <button
            onClick={async () => {
              setChecking(true);
              try {
                await onCheck();
              } finally {
                setChecking(false);
              }
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            disabled={checking}
          >
            {checking ? "Шалгаж байна..." : "Төлбөр шалгах"}
          </button>
        </div>
      </div>
    </div>
  );
}
