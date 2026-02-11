"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type QPayData = {
  ref: string; // qpayPayments docId
  qrImageDataUrl?: string | null;
  qr_image?: string | null;
  shortUrl?: string | null;
  urls?: Deeplink[];
};

function formatMnt(n: number) {
  try {
    return new Intl.NumberFormat("mn-MN").format(n);
  } catch {
    return String(n);
  }
}

export default function QPayModal({
  open,
  onClose,
  data,
  onPaid,
  amount,
  courseTitle,
  courseThumbUrl,
}: {
  open: boolean;
  onClose: () => void;
  data: QPayData | null;
  onPaid: () => void;

  amount: number;
  courseTitle: string;
  courseThumbUrl?: string | null;
}) {
  const { user } = useAuth();

  const [status, setStatus] = useState<"idle" | "checking" | "paid">("idle");
  const [lastErr, setLastErr] = useState<string | null>(null);

  // ✅ Lock body scroll while modal open (mobile/iOS)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = (document.body.style as any).overscrollBehaviorY;

    document.body.style.overflow = "hidden";
    (document.body.style as any).overscrollBehaviorY = "contain";

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).overscrollBehaviorY = prevOverscroll;
    };
  }, [open]);

  const qrSrc = useMemo(() => {
    const a = data?.qrImageDataUrl ? String(data.qrImageDataUrl) : "";
    if (a && a.startsWith("data:image/")) return a;

    const b64 = data?.qr_image ? String(data.qr_image) : "";
    if (b64) return `data:image/png;base64,${b64}`;

    return null;
  }, [data?.qrImageDataUrl, data?.qr_image]);

  // ✅ Poll check endpoint
  useEffect(() => {
    if (!open || !data?.ref) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const tick = async () => {
      try {
        if (stopped) return;

        if (!user) {
          setLastErr("Login хийгээгүй байна.");
          setStatus("idle");
          return;
        }

        setStatus("checking");
        setLastErr(null);

        const idToken = await user.getIdToken();

        const r = await fetch("/api/qpay/checkout/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ ref: data.ref }),
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          setStatus("idle");
          setLastErr(j?.message || `Check failed (${r.status})`);
          return;
        }

        if (j?.ok && (j?.paid === true || j?.status === "PAID")) {
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
  }, [open, data?.ref, user, onPaid]);

  if (!open || !data) return null;

  const bankUrls = Array.isArray(data.urls) ? data.urls : [];

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* ✅ MOBILE: full screen no padding | ✅ DESKTOP: centered */}
      <div className="absolute inset-0 flex items-stretch justify-stretch md:items-center md:justify-center p-0 md:p-4">
        <div
          className="
            w-screen h-[100dvh]
            md:h-auto md:w-full md:max-w-[1100px]
            rounded-none md:rounded-2xl
            bg-white shadow-2xl
            overflow-hidden
          "
        >
          {/* header sticky */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-4 md:px-6 py-4 md:py-5">
            <div>
              <div className="text-[17px] md:text-[18px] font-semibold text-neutral-900">Төлбөр хүлээгдэж байна</div>
              <div className="mt-1 text-[12px] md:text-[13px] text-neutral-500">
                Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50"
            >
              Хаах
            </button>
          </div>

          {/* ✅ BODY scroll (both) */}
          <div
            className="
              overflow-y-auto overscroll-contain
              [-webkit-overflow-scrolling:touch]
              h-[calc(100dvh-76px)]
              md:h-auto md:max-h-[calc(100vh-140px)]
            "
          >
            <div className="grid grid-cols-1 gap-4 md:gap-6 p-4 md:p-6 md:grid-cols-2">
              {/* LEFT */}
              <div className="rounded-2xl border bg-white p-4 md:p-6">
                <div className="text-[13px] font-medium text-neutral-700">QPay QR</div>

                <div className="mt-4 flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#5b2cff] opacity-90" />
                    <div className="text-[16px] font-semibold text-neutral-900">QPay</div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-neutral-100 p-3 md:p-4">
                    <div className="flex h-[260px] w-[260px] md:h-[280px] md:w-[280px] items-center justify-center rounded-xl bg-white">
                      {qrSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrSrc}
                          alt="QPay QR"
                          className="h-[240px] w-[240px] md:h-[260px] md:w-[260px] object-contain"
                        />
                      ) : (
                        <div className="text-center text-[13px] text-neutral-500">QR хараахан бэлэн биш</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 text-[12px] text-neutral-500">Нийт төлөх дүн:</div>
                  <div className="text-[28px] font-semibold text-neutral-900">{formatMnt(amount)}₮</div>

                  <div className="mt-4 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                    Компьютер дээр: QR-аa банкны апп-аараа уншуулж төлнө.
                  </div>

                  {data.shortUrl ? (
                    <div className="mt-3 w-full break-all text-[13px] text-neutral-600">
                      Short URL:{" "}
                      <a className="text-blue-600 underline" href={data.shortUrl} target="_blank" rel="noreferrer">
                        {data.shortUrl}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border bg-white p-4 md:p-6">
                  <div className="text-[13px] font-medium text-neutral-700">Контентууд</div>

                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-neutral-200">
                        {courseThumbUrl ? (
                          <Image
                            src={courseThumbUrl}
                            alt={courseTitle}
                            width={48}
                            height={48}
                            className="h-12 w-12 object-cover"
                          />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-neutral-900">{courseTitle}</div>
                        <div className="text-[12px] text-neutral-500">Контент</div>
                      </div>
                    </div>

                    <div className="text-[14px] font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[13px] text-neutral-700">
                    <div className="text-neutral-500">Нийт дүн</div>
                    <div className="font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                  </div>
                </div>

                {/* ✅ MOBILE ONLY: bank deeplinks */}
                <div className="rounded-2xl border bg-white p-4 md:p-6 md:hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-neutral-700">Банкны апп-аар төлөх</div>
                    <div className="text-[12px] text-neutral-500">Mobile</div>
                  </div>

                  {bankUrls.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {bankUrls.slice(0, 12).map((u, idx) => (
                        <a
                          key={`${u.link}-${idx}`}
                          href={u.link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-neutral-100 hover:bg-neutral-200 px-3 py-2 text-[13px] text-neutral-700"
                        >
                          {u.name || "Bank"}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-[13px] text-neutral-500">Bank deeplink олдсонгүй.</div>
                  )}
                </div>

                <div className="rounded-2xl border bg-white p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-medium text-neutral-700">Төлбөрийн төлөв</div>
                    <div className="text-[12px] text-neutral-500">Invoice check</div>
                  </div>

                  <div className="mt-4 text-[13px] text-neutral-700">
                    Status:{" "}
                    {status === "paid" ? "✅ PAID" : status === "checking" ? "⏳ шалгаж байна..." : "PENDING"}
                  </div>

                  {lastErr ? <div className="mt-2 text-[13px] text-red-600">{lastErr}</div> : null}

                  <div className="mt-5">
                    <button
                      onClick={onClose}
                      className="w-full rounded-xl bg-black px-5 py-3 text-[13px] font-semibold text-white hover:bg-black/90"
                    >
                      Ок
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-4 md:h-2" />
          </div>
        </div>
      </div>
    </div>
  );
}