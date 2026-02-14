"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type QPayData = {
  ref: string; // invoices docId (invoiceId)
  qrImageDataUrl?: string | null;
  qr_image?: string | null;
  shortUrl?: string | null;
  urls?: Deeplink[];

  durationLabel?: string | null;
  durationDays?: number | null;
};

const QPAY_LOGO_SRC = "/qpay-logo.png";

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

function nextDelayMs(attempt: number) {
  if (attempt <= 5) return 2500;
  if (attempt <= 12) return 5000;
  return 10000;
}

function jitter(ms: number) {
  const r = 1 + Math.random() * 0.2;
  return Math.floor(ms * r);
}

function initials(name?: string) {
  const s = String(name || "").trim();
  if (!s) return "B";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "B";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
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

  // ✅ Local “self-healed” qpay data (props-оос тусдаа)
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string | null>(null);
  const [liveUrls, setLiveUrls] = useState<Deeplink[]>([]);
  const [liveShortUrl, setLiveShortUrl] = useState<string | null>(null);

  // ✅ Portal mount guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ Lock body scroll while modal open
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

  // ✅ Reset live state when opening / ref changes
  useEffect(() => {
    if (!open) return;
    setLiveQrDataUrl(null);
    setLiveUrls([]);
    setLiveShortUrl(null);
    setLastErr(null);
  }, [open, data?.ref]);

  const durationText = useMemo(() => {
    return formatDuration(data?.durationLabel ?? null, data?.durationDays ?? null);
  }, [data?.durationLabel, data?.durationDays]);

  const qrSrc = useMemo(() => {
    // 1) live (API-аас нөхөгдсөн)
    if (liveQrDataUrl && liveQrDataUrl.startsWith("data:image/")) return liveQrDataUrl;

    // 2) props
    const a = data?.qrImageDataUrl ? String(data.qrImageDataUrl) : "";
    if (a && a.startsWith("data:image/")) return a;

    const b64 = data?.qr_image ? String(data.qr_image) : "";
    if (b64) return `data:image/png;base64,${b64}`;

    return null;
  }, [data?.qrImageDataUrl, data?.qr_image, liveQrDataUrl]);

  const bankUrls = useMemo(() => {
    const fromLive = liveUrls.length ? liveUrls : [];
    if (fromLive.length) return fromLive;
    return Array.isArray(data?.urls) ? data!.urls! : [];
  }, [data?.urls, liveUrls]);

  // =========================
  // ✅ SELF-HEAL: QR/data missing OR amount changed -> call create-invoice
  // =========================
  const ensuringRef = useRef(false);

  useEffect(() => {
    if (!open || !data?.ref) return;
    if (!user) return;

    const hasAnyBank = (Array.isArray(data?.urls) && data!.urls!.length > 0) || liveUrls.length > 0;
    const hasQr = !!qrSrc;
    const shouldEnsure = !hasQr || !hasAnyBank; // QR байхгүй, эсвэл bank deeplink хоосон бол

    if (!shouldEnsure) return;
    if (ensuringRef.current) return;

    ensuringRef.current = true;

    const run = async () => {
      try {
        setLastErr(null);

        const idToken = await user.getIdToken();
        const r = await fetch("/api/qpay/create-invoice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            ref: data.ref,
            uid: user.uid,
            // ✅ amount одоогийн UI дээрх дүнгээр заавал шинэчилнэ (150->165 fix)
            amount,
            description: `Master AI · ${courseTitle}`,
            // courseId энд заавал байх албагүй (байвал сайн)
            // courseId: (undefined)
          }),
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          setLastErr(j?.error || j?.message || `Invoice create failed (${r.status})`);
          ensuringRef.current = false;
          return;
        }

        // ✅ Live state update (UI өөрчлөхгүйгээр QR орж ирнэ)
        const qrid = String(j?.qrImageDataUrl || "");
        if (qrid && qrid.startsWith("data:image/")) setLiveQrDataUrl(qrid);

        const urls = Array.isArray(j?.urls) ? j.urls : [];
        if (urls.length) setLiveUrls(urls);

        const su = String(j?.shortUrl || "").trim();
        if (su) setLiveShortUrl(su);

        ensuringRef.current = false;
      } catch (e: any) {
        setLastErr(e?.message || "Invoice create error");
        ensuringRef.current = false;
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.ref, user, amount, courseTitle]);

  // =========================
  // ✅ Polling — unchanged (checks paid)
  // =========================
  const stopRef = useRef(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open || !data?.ref) return;

    stopRef.current = false;
    inFlightRef.current = false;

    const STARTED_AT = Date.now();
    const HARD_TIMEOUT_MS = 8 * 60 * 1000;

    let attempt = 0;

    const clearAll = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = null;

      inFlightRef.current = false;
    };

    const scheduleNext = (delayMs: number) => {
      if (stopRef.current) return;
      clearAll();
      timerRef.current = setTimeout(() => tick(), delayMs);
    };

    const tick = async () => {
      try {
        if (stopRef.current) return;

        if (Date.now() - STARTED_AT > HARD_TIMEOUT_MS) {
          stopRef.current = true;
          clearAll();
          setStatus("idle");
          return;
        }

        if (inFlightRef.current) {
          scheduleNext(jitter(1500));
          return;
        }

        if (!user) {
          setLastErr("Login хийгээгүй байна.");
          setStatus("idle");
          scheduleNext(jitter(5000));
          return;
        }

        inFlightRef.current = true;
        setStatus("checking");
        setLastErr(null);

        const hidden = typeof document !== "undefined" && document.hidden;
        const base = nextDelayMs(attempt);
        const delay = hidden ? Math.max(15000, base) : base;

        const idToken = await user.getIdToken();

        const ac = new AbortController();
        abortRef.current = ac;

        const r = await fetch("/api/qpay/checkout/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ ref: data.ref }),
          signal: ac.signal,
        });

        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          setStatus("idle");
          setLastErr(j?.message || `Check failed (${r.status})`);
          attempt += 1;
          inFlightRef.current = false;
          scheduleNext(jitter(delay));
          return;
        }

        if (j?.ok && (j?.paid === true || String(j?.status || "").toUpperCase() === "PAID")) {
          stopRef.current = true;
          clearAll();
          setStatus("paid");
          onPaid();
          return;
        }

        setStatus("idle");
        attempt += 1;
        inFlightRef.current = false;
        scheduleNext(jitter(delay));
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "Check error";
        if (!/aborted|abort/i.test(msg)) {
          setStatus("idle");
          setLastErr(msg);
        }
        attempt += 1;
        inFlightRef.current = false;

        const base = nextDelayMs(attempt);
        const hidden = typeof document !== "undefined" && document.hidden;
        const delay = hidden ? Math.max(15000, base) : base;
        scheduleNext(jitter(delay));
      }
    };

    scheduleNext(jitter(900));

    const onVis = () => {
      if (stopRef.current) return;
      if (!document.hidden) scheduleNext(300);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopRef.current = true;
      clearAll();
    };
  }, [open, data?.ref, user, onPaid]);

  if (!open || !data || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-0 md:p-6">
        <div
          className="
            w-full h-[100dvh] max-w-none
            rounded-none bg-white shadow-2xl overflow-hidden
            md:w-full md:max-w-[860px] md:h-auto md:max-h-[calc(100dvh-24px)]
            md:rounded-2xl
          "
        >
          <div className="border-b bg-white px-4 py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[18px] font-extrabold text-neutral-900 md:text-[20px] md:font-bold">
                  Төлбөр хүлээгдэж байна
                </div>
                <div className="mt-1 text-[13px] text-neutral-500 md:text-[14px]">
                  Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
                </div>
              </div>

              <button
                onClick={onClose}
                className="
                  shrink-0 rounded-full border px-4 py-2
                  text-[13px] text-neutral-700 hover:bg-neutral-50
                  md:text-[14px]
                "
              >
                Хаах
              </button>
            </div>
          </div>

          <div className="h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] md:h-auto md:max-h-[calc(100dvh-140px)]">
            <div
              className="
                mx-auto w-full max-w-none
                px-4 pt-5 pb-[max(18px,env(safe-area-inset-bottom))] space-y-6
                md:max-w-[760px] md:p-6 md:space-y-6
              "
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="relative h-8 w-8">
                    <Image src={QPAY_LOGO_SRC} alt="QPay" fill className="object-contain" priority />
                  </div>
                  <div className="text-[16px] font-semibold text-neutral-900">QPay</div>
                </div>

                <div className="mt-4 rounded-2xl bg-neutral-100 p-3">
                  <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl bg-white">
                    {qrSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrSrc} alt="QPay QR" className="h-[238px] w-[238px] object-contain" />
                    ) : (
                      <div className="text-center text-[13px] text-neutral-500">QR хараахан бэлэн биш</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-[12px] text-neutral-500">Нийт төлөх дүн:</div>
                <div className="text-[28px] font-extrabold tracking-tight text-neutral-900">
                  {formatMnt(amount)}₮
                </div>

                <div className="mt-3 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                  Та гүйлгээ хийх банкаа сонгоно уу?
                </div>

                {bankUrls.length ? (
                  <div className="mt-4 w-full">
                    <div className="grid grid-cols-4 gap-3">
                      {bankUrls.slice(0, 20).map((u, idx) => {
                        const label = u.name || "Bank";
                        return (
                          <a
                            key={`${u.link}-${idx}`}
                            href={u.link}
                            target="_blank"
                            rel="noreferrer"
                            className="
                              group flex flex-col items-center justify-center
                              rounded-2xl border border-neutral-200 bg-white
                              p-2 active:scale-[0.99]
                            "
                            aria-label={label}
                            title={label}
                          >
                            <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-neutral-100">
                              {u.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.logo} alt={label} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[16px] font-bold text-neutral-700">
                                  {initials(label)}
                                </div>
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>

                    {bankUrls.length > 20 ? (
                      <div className="mt-3 text-center text-[12px] text-neutral-500">
                        Илүү олон банк байвал доош гүйлгэнэ үү.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 text-[13px] text-neutral-500">Bank deeplink олдсонгүй.</div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:rounded-2xl md:border md:bg-white md:p-6">
                <div className="text-[13px] font-semibold text-neutral-800 md:text-[15px] md:font-bold">
                  Хичээлийн нэр
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 overflow-hidden rounded-xl bg-neutral-200 shrink-0">
                      {courseThumbUrl ? (
                        <Image
                          src={courseThumbUrl}
                          alt={courseTitle}
                          width={44}
                          height={44}
                          className="h-11 w-11 object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-neutral-900 md:text-[16px]">
                        {courseTitle}
                      </div>
                      <div className="text-[12px] text-neutral-500 md:text-[13px]">{durationText}</div>
                    </div>
                  </div>

                  <div className="text-[14px] font-extrabold text-neutral-900 md:text-[16px] md:font-bold">
                    {formatMnt(amount)}₮
                  </div>
                </div>

                <div className="hidden md:block mt-4 space-y-2 text-[14px] sm:text-[15px]">
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

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:rounded-2xl md:border md:bg-white md:p-6">
                <div className="text-[13px] font-semibold text-neutral-800 md:text-[14px] md:font-medium md:text-neutral-700">
                  Төлбөр баталгаажуулалт
                </div>

                <div className="sr-only" aria-live="polite">
                  Status: {status === "paid" ? "PAID" : status === "checking" ? "CHECKING" : "PENDING"}
                </div>

                {lastErr ? <div className="mt-3 text-[13px] text-red-600">{lastErr}</div> : null}

                <div className="mt-4">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl bg-black px-5 py-3 text-[15px] font-semibold text-white hover:bg-black/90"
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