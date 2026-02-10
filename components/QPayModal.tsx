"use client";

import { useEffect, useState } from "react";

type QPayData = {
  // 🔥 qpay_invoices docId (server return invoiceDocId)
  ref: string;

  // server-аас ирэх (шинэ нэршил)
  qrImageDataUrl?: string | null;

  // хуучин fallback (зарим газар base64 байж магадгүй)
  qr_image?: string | null;

  shortUrl?: string | null;
  urls?: Array<{ name: string; link: string; description?: string; logo?: string }>;
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
  const [lastErr, setLastErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data?.ref) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const tick = async () => {
      try {
        if (stopped) return;
        setStatus("checking");
        setLastErr(null);

        // ✅ ref = qpay_invoices docId
        const r = await fetch("/api/qpay/deeplink/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: data.ref }),
        });

        const j = await r.json().catch(() => ({}));

        if (j?.ok && j?.paid) {
          stopped = true;
          if (timer) clearInterval(timer);
          setStatus("paid");
          onPaid();
          return;
        }

        setStatus("idle");
      } catch (e: any) {
        setStatus("idle");
        setLastErr(typeof e?.message === "string" ? e.message : "Check error");
      }
    };

    tick();
    timer = setInterval(tick, 2500);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [open, data?.ref, onPaid]);

  if (!open || !data) return null;

  // ✅ 1) хамгийн түрүүнд server-аас ирсэн dataUrl ашиглана
  // ✅ 2) байхгүй бол base64-ийг dataUrl болгож fallback
  const qrSrc =
    (data.qrImageDataUrl && String(data.qrImageDataUrl)) ||
    (data.qr_image ? `data:image/png;base64,${data.qr_image}` : null);

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white text-black p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-lg">Төлбөр хүлээгдэж байна</div>
            <div className="text-sm text-black/60">QR уншуулж төлнө</div>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-black/10">
            Хаах
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* LEFT: QR */}
          <div className="rounded-2xl border p-4">
            <div className="font-medium mb-3">QPay QR</div>

            <div className="rounded-2xl bg-black/5 p-4 flex items-center justify-center min-h-[320px]">
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrSrc}
                  alt="QPay QR"
                  className="w-72 h-72 rounded-xl bg-white"
                />
              ) : (
                <div className="text-black/50">QR зураг ирсэнгүй (dataUrl null)</div>
              )}
            </div>

            {data.shortUrl ? (
              <div className="mt-3 text-sm break-all">
                Short URL:{" "}
                <a className="text-blue-600 underline" href={data.shortUrl} target="_blank" rel="noreferrer">
                  {data.shortUrl}
                </a>
              </div>
            ) : null}
          </div>

          {/* RIGHT: bank links */}
          <div className="rounded-2xl border p-4">
            <div className="font-medium mb-3">Төлбөрийн хэрэгсэл</div>

            <div className="grid grid-cols-2 gap-2">
              {(data.urls || []).slice(0, 8).map((u) => (
                <a
                  key={u.name}
                  href={u.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-black/5 hover:bg-black/10 px-3 py-2 text-sm"
                >
                  {u.name}
                </a>
              ))}
            </div>

            <div className="mt-4 text-sm">
              Status:{" "}
              {status === "paid"
                ? "✅ PAID"
                : status === "checking"
                ? "⏳ шалгаж байна..."
                : "PENDING"}
            </div>

            {lastErr ? <div className="mt-2 text-sm text-red-600">{lastErr}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}