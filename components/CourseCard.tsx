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

  const CardWrap: any = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  // ✅ MOBILE: white card + black text
  // ✅ DESKTOP (md+): original dark premium card
  const cardBase =
    "group block relative overflow-hidden rounded-3xl " +
    "bg-white border-2 border-black/10 " +
    "transition-all duration-300 ease-out transform-gpu will-change-transform " +
    "hover:scale-[1.04] hover:-translate-y-2 " +
    "md:bg-black/35 md:backdrop-blur md:border-2";

  const cardPurchased =
    "md:border-orange-400/70 md:shadow-[0_0_18px_rgba(249,115,22,0.18)] " +
    "md:hover:border-orange-300/90 md:hover:shadow-[0_0_42px_rgba(249,115,22,0.45)]";

  const cardNotPurchased =
    "md:border-cyan-400/70 md:shadow-[0_0_18px_rgba(56,189,248,0.35)] " +
    "md:hover:border-cyan-300/90 md:hover:shadow-[0_0_42px_rgba(56,189,248,0.75)]";

  // ✅ payment choice modal (логик өөрчлөхгүй)
  const [choiceOpen, setChoiceOpen] = useState(false);

  // ✅ deeplink modal (логик өөрчлөхгүй)
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
        setPayStatus(
          data?.message || data?.error || "Deeplink invoice үүсгэхэд алдаа гарлаа."
        );
        return;
      }

      const newOrderId = String(data?.orderId || "");
      const newUrls = Array.isArray(data?.urls) ? (data.urls as Deeplink[]) : [];

      setOrderId(newOrderId);
      setUrls(newUrls);
      setPayStatus(
        "Банк сонгоод төлбөрөө хийнэ үү. Төлсний дараа “Төлбөр шалгах” дарна уу."
      );
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

  // ⚠️ UI дээр button-уудыг бүр мөсөн авч байгаа ч,
  // логик чинь ирээдүйд хэрэгтэй тул устгахгүй (өөрчлөхгүй) үлдээж байна.
  function onBuyClick(e: any) {
    e.preventDefault();
    e.stopPropagation();

    if (!guardLogin()) return;
    setChoiceOpen(true);
  }

  return (
    <>
      <CardWrap
        {...wrapProps}
        className={`${cardBase} ${isPurchased ? cardPurchased : cardNotPurchased}`}
      >
        {/* THUMBNAIL */}
        <div className="relative overflow-hidden rounded-t-3xl bg-white md:bg-black/50">
          <div className="aspect-[16/9]">
            {course.thumbnailUrl ? (
              <>
                {/* background blur */}
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-25 md:opacity-40"
                />
                <div className="absolute inset-0 bg-white/55 md:bg-black/55" />

                <div
                  className={`pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
                    isPurchased
                      ? "md:bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.50),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(249,115,22,0.25),transparent_60%)]"
                      : "md:bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.55),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.25),transparent_60%)]"
                  }`}
                />

                <div
                  className={`pointer-events-none absolute -inset-8 z-10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${
                    isPurchased
                      ? "md:bg-[radial-gradient(circle,rgba(249,115,22,0.30),transparent_60%)]"
                      : "md:bg-[radial-gradient(circle,rgba(56,189,248,0.30),transparent_60%)]"
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
              <div className="grid h-full place-items-center text-black/50 md:text-white/40">
                <span className="text-sm">Thumbnail байхгүй</span>
              </div>
            )}
          </div>
        </div>

        {/* BODY — ✅ зөвхөн: year, title, price, oldPrice */}
        <div className="p-5">
          {/* Year */}
          <div className="text-sm font-semibold text-black/55 md:text-white/55">
            {course.year ?? "2025"}
          </div>

          {/* Гарчиг */}
          <div className="mt-2 text-xl font-black leading-snug text-black/95 line-clamp-2 md:text-white/95">
            {course.title}
          </div>

          {/* Үнэ + Хямдарсан үнэ */}
          <div className="mt-4 flex items-end gap-3">
            {priceText ? (
              <div className="text-2xl font-extrabold text-black md:text-white">
                {priceText}
              </div>
            ) : null}

            {course.oldPrice ? (
              <div
                className="
                  pb-[2px]
                  text-base font-extrabold
                  text-red-600 line-through
                  drop-shadow-none
                  md:text-red-400 md:drop-shadow-[0_0_6px_rgba(248,113,113,0.9)]
                "
              >
                {money(Number(course.oldPrice))}₮
              </div>
            ) : null}
          </div>

          {/* ✅ “ХУДАЛДАЖ АВАХ / ХИЧЭЭЛ ҮЗЭХ” хэсгийг бүр мөсөн арилгасан */}
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