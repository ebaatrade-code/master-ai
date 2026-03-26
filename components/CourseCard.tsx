"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import QPayDeeplinkModal from "@/components/QPayDeeplinkModal";

type Course = {
  id: string;
  title: string;
  price?: number;
  oldPrice?: number;
  thumbnailUrl?: string;
  year?: string;
  category?: string;
  durationLabel?: string;
  shortDescription?: string;
};

const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("mn-MN") : "0";


type Props = {
  course: Course;
  isPurchased: boolean;
  href?: string;
};

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

export default function CourseCard({ course, isPurchased, href }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const priceNum = Number(course.price ?? 0);
  const priceText =
    Number.isFinite(priceNum) && priceNum > 0 ? `${money(priceNum)}₮` : "";

  const oldPriceNum = Number(course.oldPrice ?? 0);
  const hasOldPrice = Number.isFinite(oldPriceNum) && oldPriceNum > 0 && oldPriceNum > priceNum;

  // Auto-calculate discount %
  const discountPct =
    hasOldPrice && priceNum > 0
      ? Math.round((1 - priceNum / oldPriceNum) * 100)
      : null;

  const CardWrap: any = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  // ── State (unchanged) ──────────────────────────────
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [orderId, setOrderId] = useState("");
  const [urls, setUrls] = useState<Deeplink[]>([]);
  const amount = useMemo(() => Number(course.price ?? 0), [course.price]);

  // ── Guards & handlers (unchanged) ─────────────────
  function guardLogin(): boolean {
    if (user) return true;
    const cb = href || "/";
    router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`);
    return false;
  }

  async function createBankDeeplinkInvoice() {
    if (!guardLogin()) return;
    if (!course?.id) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      setBankOpen(true);
      setPayStatus("Үнэ буруу байна. Admin дээр course price-аа шалгаарай.");
      return;
    }
    try {
      setBankOpen(true);
      setPayStatus("Банкны deeplink үүсгэж байна…");
      setOrderId("");
      setUrls([]);
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/qpay/deeplink/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ courseId: course.id }), // amount client-ээс дамжуулахгүй — server татна
      });
      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        setPayStatus(data?.message || data?.error || "Deeplink invoice үүсгэхэд алдаа гарлаа.");
        return;
      }
      setOrderId(String(data?.orderId || ""));
      setUrls(Array.isArray(data?.urls) ? (data.urls as Deeplink[]) : []);
      setPayStatus('Банк сонгоод төлбөрөө хийнэ үү. Төлсний дараа "Төлбөр шалгах" дарна уу.');
    } catch (e: any) {
      setPayStatus(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    }
  }

  async function handleCheckPayment() {
    if (!user || !orderId) {
      setPayStatus("Order олдсонгүй. Дахин АВАХ дарж оролдоно уу.");
      return;
    }
    try {
      setPayStatus("Төлбөр шалгаж байна…");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/qpay/deeplink/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ orderId }),
      });
      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        setPayStatus(data?.message || data?.error || "Төлбөр шалгахад алдаа гарлаа.");
        return;
      }
      if (data?.status === "PAID") {
        setPayStatus("Төлбөр баталгаажлаа ✅ Курс нээгдлээ!");
        setBankOpen(false);
        router.refresh();
      } else {
        setPayStatus("Одоогоор төлбөр баталгаажаагүй байна. Дахин шалгана уу.");
      }
    } catch (e: any) {
      setPayStatus(e?.message || "Шалгах үед алдаа гарлаа. Дахин оролдоно уу.");
    }
  }

  function onBuyClick(e: any) {
    e.preventDefault();
    e.stopPropagation();
    if (!guardLogin()) return;
    setChoiceOpen(true);
  }

  // ── Render ─────────────────────────────────────────
  return (
    <>
      <CardWrap
        {...wrapProps}
        className="group block relative overflow-hidden rounded-[22px] bg-white border border-black/8 shadow-[0_2px_16px_rgba(0,0,0,0.05)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_10px_32px_rgba(0,0,0,0.10)]"
      >

        {/* ── THUMBNAIL ── */}
        <div className="relative overflow-hidden aspect-[16/9] bg-[#EDEDEA]">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <svg className="h-10 w-10 text-black/20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}

          {/* Discount badge — neon rotating glow */}
          {discountPct && (
            <div className="absolute top-3 left-3" style={{position:'absolute',top:'12px',left:'12px'}}>
              <style>{`
                @keyframes disc-spin {
                  to { transform: rotate(360deg); }
                }
                @keyframes disc-pulse {
                  0%,100% { opacity:1; }
                  50%      { opacity:0.7; }
                }
                .disc-wrap::before {
                  content:'';
                  position:absolute;
                  inset:-80%;
                  background:conic-gradient(from 0deg,#ff0000,#ff3300,#ff6600,#ff0000);
                  animation:disc-spin 2s linear infinite;
                  border-radius:999px;
                }
              `}</style>
              <div
                className="disc-wrap"
                style={{
                  position:'relative',
                  borderRadius:'999px',
                  padding:'2px',
                  overflow:'hidden',
                  display:'inline-block',
                }}
              >
                <div style={{
                  position:'relative',
                  zIndex:1,
                  background:'#111',
                  borderRadius:'999px',
                  padding:'4px 10px',
                  fontSize:'11px',
                  fontWeight:900,
                  color:'#fff',
                  lineHeight:1,
                  letterSpacing:'0.03em',
                  whiteSpace:'nowrap',
                  textShadow:'0 0 8px rgba(255,100,40,0.9)',
                  boxShadow:'0 0 10px rgba(255,70,30,0.6)',
                  animation:'disc-pulse 2s ease-in-out infinite',
                }}>
                  −{discountPct}%
                </div>
              </div>
            </div>
          )}

          {/* Category badge */}
          {course.category && (
            <div className="absolute top-3 right-3 rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-[5px] text-[11px] font-semibold text-white leading-none">
              {course.category}
            </div>
          )}

          {/* Purchased: play hint on hover */}
          {isPurchased && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-sm px-4 py-2 text-[13px] font-bold text-black shadow-lg">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Үзэх
              </div>
            </div>
          )}
        </div>

        {/* ── BODY ── */}
        <div className="px-3 pt-2.5 pb-3 md:px-5 md:pt-4 md:pb-5">

          {/* Year */}
          <p className="text-[9px] md:text-[11px] font-semibold uppercase tracking-[0.08em] text-black/35">
            {course.year ?? "2025"}
          </p>

          {/* Title */}
          <p className="mt-1 md:mt-1.5 text-[12px] md:text-[15px] font-bold leading-snug text-black line-clamp-2 md:min-h-[42px]">
            {course.title}
          </p>

          {/* Duration (optional) */}
          {course.durationLabel && (
            <div className="mt-1.5 md:mt-2 flex items-center gap-1 md:gap-1.5 text-[10px] md:text-[12px] text-black/38 font-medium">
              <svg className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/>
              </svg>
              {course.durationLabel}
            </div>
          )}

          {/* Divider */}
          <div className="mt-2.5 mb-2.5 md:mt-4 md:mb-4 h-px bg-black/6" />

          {/* Price + CTA — always one row */}
          <div className="flex items-center justify-between gap-1">

            {/* Prices */}
            <div className="flex items-baseline gap-1 min-w-0 shrink-0">
              {priceText && (
                <span className="text-[11px] md:text-[22px] font-extrabold tracking-tight text-black leading-none">
                  {priceText}
                </span>
              )}
              {hasOldPrice && (
                <span className="hidden md:inline text-[13px] font-medium text-black/30 line-through">
                  {money(oldPriceNum)}₮
                </span>
              )}
            </div>

            {/* CTA */}
            {isPurchased ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-black/8 bg-black/[0.03] px-2 py-1.5 md:px-3.5 md:py-2 text-[8px] md:text-[12px] font-semibold text-black/50">
                <svg className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg>
                Нээлттэй
              </span>
            ) : (
              <button
                type="button"
                onClick={onBuyClick}
                className="shrink-0 inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-1.5 md:px-4 md:py-2 text-[8px] md:text-[13px] font-bold text-black shadow-[0_3px_10px_rgba(241,196,91,0.4)] transition-all hover:brightness-105 active:scale-95"
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
              >
                <svg className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Худалдаж авах
              </button>
            )}
          </div>
        </div>
      </CardWrap>

      <QPayDeeplinkModal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title={course.title}
        amount={amount}
        urls={urls}
        statusText={payStatus}
        onCheck={handleCheckPayment}
      />
    </>
  );
}
