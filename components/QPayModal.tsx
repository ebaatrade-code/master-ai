"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type QPayData = {
  ref: string; // invoices/qpayPayments docId (invoiceDocId)
  amount?: number | null;

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

function num(x: unknown) {
  if (typeof x === "number") return x;
  if (typeof x === "string" && x.trim()) return Number(x);
  return NaN;
}

function isSafeHttpUrl(v: unknown) {
  const s = String(v || "").trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s);
}

function normalizeSafeUrls(input: unknown): Deeplink[] {
  if (!Array.isArray(input)) return [];

  const out: Deeplink[] = [];

  for (const item of input.slice(0, 20)) {
    const link = String((item as any)?.link || "").trim();
    if (!isSafeHttpUrl(link)) continue;

    out.push({
      name: String((item as any)?.name || "").trim().slice(0, 120),
      description: String((item as any)?.description || "").trim().slice(0, 180),
      logo: String((item as any)?.logo || "").trim().slice(0, 1200),
      link,
    });
  }

  return out;
}

export default function QPayModal({
  open,
  onClose,
  data,
  onPaid,
  amount,
  courseTitle,
  courseThumbUrl,
  courseId,
}: {
  open: boolean;
  onClose: () => void;
  data: QPayData | null;
  onPaid: () => void;

  amount: number;
  courseTitle: string;
  courseThumbUrl?: string | null;

  courseId?: string | null;
}) {
  const { user } = useAuth();

  const [status, setStatus] = useState<"idle" | "checking" | "paid">("idle");
  const [lastErr, setLastErr] = useState<string | null>(null);

  // ✅ Active ref (checkout/create → invoiceDocId-г энд хадгална)
  const [activeRef, setActiveRef] = useState<string>("");

  // ✅ Live qpay data (props-оос тусдаа)
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string | null>(null);
  const [liveUrls, setLiveUrls] = useState<Deeplink[]>([]);
  const [liveShortUrl, setLiveShortUrl] = useState<string | null>(null);

  // ✅ Live meta (server truth)
  const [liveAmount, setLiveAmount] = useState<number | null>(null);
  const [liveDurationLabel, setLiveDurationLabel] = useState<string | null>(null);
  const [liveDurationDays, setLiveDurationDays] = useState<number | null>(null);

  const displayAmount = useMemo(() => {
    const v = liveAmount;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    return amount;
  }, [liveAmount, amount]);

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

    setStatus("idle");
    setLiveQrDataUrl(null);
    setLiveUrls([]);
    setLiveShortUrl(null);
    setLiveAmount(null);
    setLiveDurationLabel(null);
    setLiveDurationDays(null);
    setLastErr(null);

    // activeRef-г эхлээд props data.ref-ээс авна (хэрвээ ирсэн бол)
    const r = String(data?.ref || "").trim();
    setActiveRef(r);
  }, [open, data?.ref]);

  const durationText = useMemo(() => {
    const lbl = liveDurationLabel ?? data?.durationLabel ?? null;
    const days = liveDurationDays ?? data?.durationDays ?? null;
    return formatDuration(lbl, days);
  }, [data?.durationLabel, data?.durationDays, liveDurationLabel, liveDurationDays]);

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
    if (fromLive.length) return normalizeSafeUrls(fromLive);
    return normalizeSafeUrls(data?.urls);
  }, [data?.urls, liveUrls]);

  const shortUrl = useMemo(() => {
    const s = String(liveShortUrl || data?.shortUrl || "").trim();
    return isSafeHttpUrl(s) ? s : "";
  }, [liveShortUrl, data?.shortUrl]);

  // =========================
  // ✅ STANDARD: ensure invoice via /api/qpay/checkout/create
  // - qpayPayments + invoices хоёуланг үүсгэнэ
  // - invoiceDocId-г activeRef болгоно (polling/check үүгээр явна)
  // =========================
  const ensuringRef = useRef(false);
  // ✅ Нэг open session дотор зөвхөн нэг удаа create хийнэ
  const ensuredForOpenRef = useRef(false);

  // ✅ Modal хаагдах үед reset
  useEffect(() => {
    if (!open) {
      ensuredForOpenRef.current = false;
      ensuringRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!user) return;

    const cid = String(courseId || "").trim();
    if (!cid) return; // courseId байхгүй бол checkout/create ажиллахгүй

    // ✅ Энэ open session-д аль хэдийн create хийсэн бол дахин хийхгүй
    if (ensuredForOpenRef.current) return;
    if (ensuringRef.current) return;

    ensuringRef.current = true;
    ensuredForOpenRef.current = true;
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      try {
        setLastErr(null);

        const idToken = await user.getIdToken();
        const r = await fetch("/api/qpay/checkout/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            courseId: cid,
            // ✅ amount явуулахгүй. Server course.price-оос өөрөө уншина.
            description: `Master AI · ${courseTitle}`,
          }),
          signal: ac.signal,
        });

        const j = await r.json().catch(() => ({}));

        if (cancelled) return;

        if (!r.ok || !j?.ok) {
          setLastErr(j?.message || j?.error || `Checkout create failed (${r.status})`);
          ensuringRef.current = false;
          return;
        }

        // ✅ alreadyPurchased бол modal-г гацаахгүй
        if (j?.alreadyPurchased === true) {
          setStatus("paid");
          ensuringRef.current = false;
          onPaid();
          return;
        }

        // ✅ invoiceDocId → activeRef (энэ ref-ээр check хийнэ)
        const newRef = String(j?.invoiceDocId || j?.invoiceDocID || j?.ref || "").trim();
        if (newRef) setActiveRef(newRef);

        // ✅ Live state update (UI өөрчлөхгүйгээр QR/urls орж ирнэ)
        const qrid = String(j?.qrImageDataUrl || "");
        if (qrid && qrid.startsWith("data:image/")) setLiveQrDataUrl(qrid);

        const urls = normalizeSafeUrls(j?.urls);
        if (urls.length) setLiveUrls(urls);

        const su = String(j?.shortUrl || "").trim();
        if (isSafeHttpUrl(su)) setLiveShortUrl(su);

        const a = num(j?.amount);
        if (Number.isFinite(a) && a > 0) setLiveAmount(Math.round(a));

        const dl = String(j?.durationLabel || "").trim();
        if (dl) setLiveDurationLabel(dl);

        const dd = num(j?.durationDays);
        if (Number.isFinite(dd) && dd > 0) setLiveDurationDays(Math.round(dd));

        ensuringRef.current = false;
      } catch (e: any) {
        if (!cancelled && !/aborted|abort/i.test(String(e?.message || ""))) {
          setLastErr(e?.message || "Checkout create error");
        }
        ensuringRef.current = false;
      }
    };

    run();

    return () => {
      cancelled = true;
      ac.abort();
      // ✅ ensuredForOpenRef-г reset хийхгүй — дахин create хийхгүй байхын тулд
    };
  }, [open, user, courseId, courseTitle, onPaid]);

  // =========================
  // ✅ Polling — uses /api/qpay/checkout/check with activeRef
  // =========================
  const stopRef = useRef(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!user) return;

    const refToCheck = String(activeRef || "").trim();
    if (!refToCheck) return;

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

        const ar = String(activeRef || "").trim();
        if (!ar) {
          setStatus("idle");
          scheduleNext(jitter(2000));
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
          body: JSON.stringify({ ref: ar }),
          signal: ac.signal,
          cache: "no-store",
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
  }, [open, user, activeRef, onPaid]);

  if (!open || !mounted) return null;

  // data null байж болох ч UI-г эвдэхгүйгээр fallback харуулна
  const safeTitle = courseTitle || "—";
  const safeThumb = courseThumbUrl ?? null;

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
                  {formatMnt(displayAmount)}₮
                </div>

                {/* ✅ Mobile дээр хуучин текст, Desktop дээр шинэ текст */}
                <div className="mt-3 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                  <span className="md:hidden">Та дурын банкаа сонгож ороод төлбөрөө төлөх боломжтой.</span>
                  <span className="hidden md:inline">Та дээрх QPAY - г уншуулаад төлбөрөө төлөх боломжтой.</span>
                </div>

                {bankUrls.length ? (
                  // ✅ MOBILE дээр л харагдана. DESKTOP (md↑) дээр бүр нуугдана.
                  <div className="mt-4 w-full md:hidden">
                    <div className="grid grid-cols-4 gap-3">
                      {bankUrls.slice(0, 20).map((u, idx) => {
                        const label = u.name || "Bank";
                        return (
                          <a
                            key={`${u.link}-${idx}`}
                            href={u.link}
                            target="_blank"
                            rel="noopener noreferrer"
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
                ) : shortUrl ? (
                  <div className="mt-4 w-full md:hidden">
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-[13px] font-semibold text-neutral-800"
                    >
                      QPay холбоосоор нээх
                    </a>
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
                      {safeThumb ? (
                        <Image
                          src={safeThumb}
                          alt={safeTitle}
                          width={44}
                          height={44}
                          className="h-11 w-11 object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-neutral-900 md:text-[16px]">
                        {safeTitle}
                      </div>
                      <div className="text-[12px] text-neutral-500 md:text-[13px]">{durationText}</div>
                    </div>
                  </div>

                  <div className="text-[14px] font-extrabold text-neutral-900 md:text-[16px] md:font-bold">
                    {formatMnt(displayAmount)}₮
                  </div>
                </div>

                <div className="hidden md:block mt-4 space-y-2 text-[14px] sm:text-[15px]">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-neutral-900">ҮНЭ</div>
                    <div className="font-semibold text-neutral-900">{formatMnt(displayAmount)}₮</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="font-bold text-neutral-900">Нийт дүн</div>
                    <div className="font-semibold text-neutral-900">{formatMnt(displayAmount)}₮</div>
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
                    className="w-full rounded-xl border border-black bg-white px-5 py-3 text-[15px] font-semibold text-black hover:bg-black/5 active:scale-[0.99] transition-all"
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