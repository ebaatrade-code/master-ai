"use client";

import { useEffect, useState } from "react";

type QPayData = {
  invoice_id: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: Array<{ name: string; link: string; description?: string }>;
};

export default function QPayModal({
  open,
  onClose,
  data,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  data: QPayData | null;
  onPaid: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "checking" | "paid">("idle");

  useEffect(() => {
    if (!open || !data?.invoice_id) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const tick = async () => {
      try {
        if (stopped) return;
        setStatus("checking");

        const r = await fetch("/api/qpay/payment/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: data.invoice_id }),
        });

        const j = await r.json();

        if (j?.ok && j?.paid) {
          stopped = true;
          if (timer) clearInterval(timer);
          setStatus("paid");
          onPaid();
          return;
        }

        // paid биш бол idle руу буцаана
        setStatus("idle");
      } catch {
        setStatus("idle");
      }
    };

    // шууд нэг шалгаад, дараа нь interval
    tick();
    timer = setInterval(tick, 2500);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [open, data?.invoice_id, onPaid]);

  if (!open || !data) return null;

  const qrSrc = data.qr_image ? `data:image/png;base64,${data.qr_image}` : null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0B0F14] border border-white/10 p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">QPay төлбөр</div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-white/10">
            Хаах
          </button>
        </div>

        {qrSrc ? (
          <div className="bg-white rounded-xl p-3 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QPay QR" className="w-64 h-64" />
          </div>
        ) : (
          <div className="text-white/70">QR зураг ирсэнгүй</div>
        )}

        {data.qPay_shortUrl ? (
          <div className="mt-3 text-sm text-white/80 break-all">
            ShortUrl:{" "}
            <a className="underline" href={data.qPay_shortUrl} target="_blank" rel="noreferrer">
              {data.qPay_shortUrl}
            </a>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(data.urls || []).slice(0, 8).map((u) => (
            <a
              key={u.name}
              href={u.link}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
            >
              {u.name}
            </a>
          ))}
        </div>

        <div className="mt-4 text-sm text-white/70">
          Status:{" "}
          {status === "paid" ? "✅ PAID" : status === "checking" ? "⏳ шалгаж байна..." : "PENDING"}
        </div>
      </div>
    </div>
  );
}
