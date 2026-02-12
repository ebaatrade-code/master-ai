"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type QPayData = {
  ref: string; // qpayPayments docId
  qrImageDataUrl?: string | null;
  qr_image?: string | null;
  shortUrl?: string | null;
  urls?: Deeplink[];

  // ✅ OPTIONAL: course duration (if caller passes it)
  durationLabel?: string | null; // e.g. "180 хоногоор", "3 сар"
  durationDays?: number | null; // e.g. 180
};

const QPAY_LOGO_SRC = "/qpay-logo.png"; // ✅ put file in /public/qpay-logo.png

function formatMnt(n: number) {
  try {
    return new Intl.NumberFormat("mn-MN").format(n);
  } catch {
    return String(n);
  }
}

function formatDuration(durationLabel?: string | null, durationDays?: number | null) {
  const lbl = (durationLabel || "").trim();
  if (lbl) return lbl;
  const days = typeof durationDays === "number" && durationDays > 0 ? durationDays : null;
  if (days) return `${days} хоногоор`;
  return "—";
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

  // ✅ Portal mount guard (SSR safe)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const durationText = useMemo(() => {
    return formatDuration(data?.durationLabel ?? null, data?.durationDays ?? null);
  }, [data?.durationLabel, data?.durationDays]);

  // ✅ Poll check endpoint (логик хэвээр)
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

  if (!open || !data || !mounted) return null;

  const bankUrls = Array.isArray(data.urls) ? data.urls : [];

  const modal = (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* ✅ ALWAYS CENTERED */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 md:p-6">
        <div
          className="
            w-full max-w-[860px]
            max-h-[calc(100dvh-24px)]
            rounded-2xl bg-white shadow-2xl
            overflow-hidden
          "
        >
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b bg-white px-5 sm:px-6 py-4 sm:py-5">
            <div>
              <div className="text-[18px] sm:text-[20px] font-bold text-neutral-900">
                Төлбөр хүлээгдэж байна
              </div>
              <div className="mt-1 text-[13px] sm:text-[14px] text-neutral-500">
                Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border px-4 py-2 text-[13px] sm:text-[14px] text-neutral-700 hover:bg-neutral-50"
            >
              Хаах
            </button>
          </div>

          {/* body scroll */}
          <div className="overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] max-h-[calc(100dvh-140px)]">
            <div className="mx-auto w-full max-w-[760px] p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* QPAY / QR */}
              <div className="rounded-2xl border bg-white p-4 sm:p-6">
                <div className="flex flex-col items-center">
                  {/* ✅ QPay Logo */}
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8">
                      <Image src={QPAY_LOGO_SRC} alt="QPay" fill className="object-contain" priority />
                    </div>
                    <div className="text-[16px] sm:text-[17px] font-semibold text-neutral-900">QPay</div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-neutral-100 p-3 sm:p-4">
                    <div className="flex h-[250px] w-[250px] sm:h-[280px] sm:w-[280px] items-center justify-center rounded-xl bg-white">
                      {qrSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrSrc}
                          alt="QPay QR"
                          className="h-[230px] w-[230px] sm:h-[260px] sm:w-[260px] object-contain"
                        />
                      ) : (
                        <div className="text-center text-[13px] sm:text-[14px] text-neutral-500">
                          QR хараахан бэлэн биш
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 text-[13px] sm:text-[14px] text-neutral-500">Нийт төлөх дүн:</div>
                  <div className="text-[30px] sm:text-[34px] font-semibold text-neutral-900">{formatMnt(amount)}₮</div>

                  <div className="mt-4 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[13px] sm:text-[14px] text-neutral-600">
                    Компьютер дээр: QR-аa банкны апп-аараа уншуулж төлнө.
                  </div>
                </div>
              </div>

              {/* Course info */}
              <div className="rounded-2xl border bg-white p-4 sm:p-6">
                <div className="text-[14px] sm:text-[15px] font-bold text-neutral-900">Хичээлийн нэр</div>

                <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-neutral-200 shrink-0">
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

                      <div className="min-w-0">
                        <div className="truncate text-[15px] sm:text-[16px] font-bold text-neutral-900">
                          {courseTitle}
                        </div>

                        {/* ✅ "Контент" -> Duration */}
                        <div className="text-[12px] sm:text-[13px] text-neutral-500">{durationText}</div>
                      </div>
                    </div>

                    <div className="text-[15px] sm:text-[16px] font-bold text-neutral-900">
                      {formatMnt(amount)}₮
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-[14px] sm:text-[15px]">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-neutral-900">ҮНЭ</div>
                    <div className="font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="font-bold text-neutral-900">Нийт дүн</div>
                    <div className="font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                  </div>
                </div>
              </div>

              {/* mobile deeplinks */}
              <div className="rounded-2xl border bg-white p-4 sm:p-6 md:hidden">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] sm:text-[14px] font-medium text-neutral-700">Банкны апп-аар төлөх</div>
                  <div className="text-[12px] sm:text-[13px] text-neutral-500">Mobile</div>
                </div>

                {bankUrls.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {bankUrls.slice(0, 12).map((u, idx) => (
                      <a
                        key={`${u.link}-${idx}`}
                        href={u.link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-neutral-100 hover:bg-neutral-200 px-3 py-2 text-[13px] sm:text-[14px] text-neutral-700"
                      >
                        {u.name || "Bank"}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[13px] sm:text-[14px] text-neutral-500">Bank deeplink олдсонгүй.</div>
                )}
              </div>

              {/* confirm + button */}
              <div className="rounded-2xl border bg-white p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] sm:text-[14px] font-medium text-neutral-700">Төлбөр баталгаажуулалт</div>
                </div>

                <div className="sr-only" aria-live="polite">
                  Status: {status === "paid" ? "PAID" : status === "checking" ? "CHECKING" : "PENDING"}
                </div>

                {lastErr ? <div className="mt-3 text-[13px] sm:text-[14px] text-red-600">{lastErr}</div> : null}

                <div className="mt-5">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl bg-black px-5 py-3 text-[14px] sm:text-[15px] font-semibold text-white hover:bg-black/90"
                  >
                    Ок
                  </button>
                </div>
              </div>

              <div className="h-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}