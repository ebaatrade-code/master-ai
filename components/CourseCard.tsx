"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import PaymentChoiceModal from "@/components/PaymentChoiceModal";
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

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString("mn-MN") : "0");

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
  const priceText = Number.isFinite(priceNum) && priceNum > 0 ? `${money(priceNum)}₮ / сар` : "";

  const durationLabel = (course.durationLabel ?? "").trim();
  const shortDescription = (course.shortDescription ?? "").trim();

  const CardWrap: any = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  const cardBase =
    "group block relative overflow-hidden rounded-3xl bg-black/35 backdrop-blur border-2 " +
    "transition-all duration-300 ease-out transform-gpu will-change-transform " +
    "hover:scale-[1.02] hover:-translate-y-1";

  const cardPurchased =
    "border-orange-400/70 shadow-[0_0_18px_rgba(249,115,22,0.18)] " +
    "hover:border-orange-300/90 hover:shadow-[0_0_42px_rgba(249,115,22,0.45)]";

  const cardNotPurchased =
    "border-cyan-400/70 shadow-[0_0_18px_rgba(56,189,248,0.35)] " +
    "hover:border-cyan-300/90 hover:shadow-[0_0_42px_rgba(56,189,248,0.75)]";

  // ✅ payment choice modal
  const [choiceOpen, setChoiceOpen] = useState(false);

  // ✅ deeplink modal
  const [bankOpen, setBankOpen] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [orderId, setOrderId] = useState("");
  const [urls, setUrls] = useState<Deeplink[]>([]);

  const amount = useMemo(() => Number(course.price ?? 0), [course.price]);

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId: course.id,
          amount,
          title: course.title,
        }),
      });

      const data: any = await res.json().catch(() => null);

      if (!res.ok) {
        setPayStatus(data?.message || data?.error || "Deeplink invoice үүсгэхэд алдаа гарлаа.");
        return;
      }

      const newOrderId = String(data?.orderId || "");
      const newUrls = Array.isArray(data?.urls) ? (data.urls as Deeplink[]) : [];

      setOrderId(newOrderId);
      setUrls(newUrls);
      setPayStatus("Банк сонгоод төлбөрөө хийнэ үү. Төлсний дараа “Төлбөр шалгах” дарна уу.");
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

  return (
    <>
      <CardWrap {...wrapProps} className={`${cardBase} ${isPurchased ? cardPurchased : cardNotPurchased}`}>
        {/* THUMBNAIL */}
        <div className="relative overflow-hidden rounded-t-3xl bg-black/50">
          <div className="aspect-[16/9]">
            {course.thumbnailUrl ? (
              <>
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
                />
                <div className="absolute inset-0 bg-black/55" />

                <div
                  className={`pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
                    isPurchased
                      ? "bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.50),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(249,115,22,0.25),transparent_60%)]"
                      : "bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.55),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.25),transparent_60%)]"
                  }`}
                />

                <div
                  className={`pointer-events-none absolute -inset-8 z-10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${
                    isPurchased
                      ? "bg-[radial-gradient(circle,rgba(249,115,22,0.30),transparent_60%)]"
                      : "bg-[radial-gradient(circle,rgba(56,189,248,0.30),transparent_60%)]"
                  }`}
                />

                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="relative z-20 h-full w-full object-cover"
                  loading="lazy"
                />
              </>
            ) : (
              <div className="grid h-full place-items-center text-white/40">
                <span className="text-sm">Thumbnail байхгүй</span>
              </div>
            )}
          </div>

          {durationLabel ? (
            <div className="absolute left-3 top-3 z-30 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/80">
              {durationLabel}
            </div>
          ) : null}
        </div>

        {/* BODY */}
        <div className="p-4">
          <div className="text-[11px] text-white/55">
            {(course.year ?? "2025") + " • " + (course.category ?? "Онлайн сургалт")}
          </div>

          <div className="mt-2 text-base font-extrabold text-white/90 line-clamp-1">{course.title}</div>

          {shortDescription ? (
            <div className="mt-2 text-sm leading-6 text-white/70 line-clamp-2">{shortDescription}</div>
          ) : (
            <div className="mt-2 text-sm text-white/40">(Товч тайлбар оруулаагүй)</div>
          )}

          <div className="mt-4 flex items-end justify-between gap-3">
            {!isPurchased ? (
              <>
                <div>
                  <div className="text-lg font-extrabold text-white">{priceText}</div>
                  {course.oldPrice ? (
                    <div className="text-xs text-white/45 line-through">{money(Number(course.oldPrice))}₮</div>
                  ) : null}
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  🔒 Худалдаж аваагүй
                </div>
              </>
            ) : (
              <div className="text-sm text-white/70 group-hover:text-white">Худалдаж авсан ✅</div>
            )}
          </div>

          {!isPurchased ? (
            <div
              onClick={onBuyClick}
              role="button"
              className="
                mt-4 w-full rounded-full
                border-2 border-cyan-400/60
                bg-gradient-to-r from-cyan-500 to-blue-600
                px-5 py-3 text-center text-sm font-extrabold text-white
                shadow-[0_0_18px_rgba(56,189,248,0.55)]
                hover:shadow-[0_0_34px_rgba(56,189,248,1)]
                hover:from-cyan-400 hover:to-blue-500
                transition-all duration-300
                cursor-pointer
              "
            >
              АВАХ →
            </div>
          ) : (
            <div
              className="
                mt-4 w-full rounded-full
                border-2 border-orange-300/40
                bg-gradient-to-r from-orange-400 to-orange-600
                px-5 py-3 text-center text-sm font-extrabold text-black
                shadow-[0_0_22px_rgba(251,146,60,0.85)]
                hover:shadow-[0_0_36px_rgba(251,146,60,1)]
                transition-all duration-300
              "
            >
              ҮЗЭХ →
            </div>
          )}
        </div>
      </CardWrap>

      {/* ✅ 2 сонголтын modal */}
      <PaymentChoiceModal
        open={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        onChooseQpay={() => {
          setChoiceOpen(false);
          // QPay QR хэсгийг дараа нь холбоно (production дээр)
          setBankOpen(true);
          setPayStatus("QPAY QR хэсгийг дараагийн алхам дээр production дээр холбоно. Одоохондоо 'Банкны аппаар төлөх'-ийг тестлэе.");
        }}
        onChooseBank={() => {
          setChoiceOpen(false);
          createBankDeeplinkInvoice();
        }}
      />

      {/* ✅ Deeplink modal */}
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
