"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  isAuthed: boolean;
  loadingAuth: boolean;
  onLogin: () => void;
};

const SLIDES = [
  "/hero/slide-1-v2.png",
  "/hero/slide-2-v2.png",
  "/hero/slide-3-v2.jpg",
  "/hero/slide-4-v2.jpg",
];

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function HeroAgentSection({
  isAuthed,
  loadingAuth,
  onLogin,
}: Props) {
  /* =========================
     Carousel
  ========================= */
  const [idx, setIdx] = useState(0);
  const [isHover, setIsHover] = useState(false);
  const timerRef = useRef<number | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (isHover) return;
    if (SLIDES.length <= 1) return;

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setIdx((v) => (v + 1) % SLIDES.length);
    }, 1500);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isHover, prefersReducedMotion]);

  // swipe (mobile)
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;

    if (Math.abs(dx) < 40) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dt > 1200) return;

    if (dx < 0) setIdx((v) => (v + 1) % SLIDES.length);
    else setIdx((v) => (v - 1 + SLIDES.length) % SLIDES.length);
  }

  return (
    <section className="relative w-full overflow-hidden bg-white text-black md:bg-white md:text-black">
      {/* ✅ REMOVE: Ambient glow accents (purple/cyan tuyaag 100% arilgav) */}

      <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 md:pt-10 md:pb-14">
        {/* =========================
            TOP: 21:9 CAROUSEL
        ========================= */}
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl",
            "ring-1 ring-black/10 md:ring-black/10",
            "shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
          )}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* ✅ 21:9 ratio */}
          <div className="relative w-full aspect-[21/9] min-h-[220px] md:min-h-[300px]">
            {SLIDES.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={`Hero slide ${i + 1}`}
                fill
                priority={i === idx}
                sizes="(max-width: 768px) 100vw, 1200px"
                className={cn(
                  "object-cover transition-opacity duration-700",
                  i === idx ? "opacity-100" : "opacity-0"
                )}
              />
            ))}

            {/* dots bottom-left */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
              {SLIDES.map((_, i) => {
                const active = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setIdx(i)}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition",
                      active ? "bg-black" : "bg-black/35 ring-1 ring-black/45"
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================
            BELOW: LEFT BENEFITS | RIGHT TITLE
        ========================= */}
        <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-12 md:items-start">
          {/* ✅ SWAP: TITLE (was RIGHT) -> LEFT */}
          <div className="order-1 md:order-1">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold leading-[1.15] text-black md:text-black">
              АЖИЛ ХИЙХҮҮ{" "}
              <span className="text-black md:text-black">AI AGENT</span>
              <br />
              АЖЛУУЛАХ УУ!
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-black md:text-black md:text-lg">
              2026 онд контент, судалгаа, маркетинг зэрэг давтагддаг ажлуудыг AI
              Agent-ууд гүйцэтгэнэ. Чи сураад ажлаа AI Agent-ээр хийлгэх үү,
              эсвэл өөрөө бүхнийг гараараа хийсээр үлдэх үү?
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {/* ✅ КОНТЕНТ ҮЗЭХ: Gradient stroke + white bold text */}
              <span className="inline-flex rounded-full bg-gradient-to-r from-[#0B5BFF] via-[#5B5CFF] to-[#C35CFF] p-[2px]">
                <a
                  href="#contents"
                  className="
                    inline-flex h-[44px] items-center justify-center rounded-full px-8
                    text-sm font-semibold text-black
                    bg-transparent
                    hover:bg-black/10 active:bg-black/15
                    transition
                  "
                >
                  КОНТЕНТ ҮЗЭХ
                </a>
              </span>

              {loadingAuth ? (
                <div className="h-[44px] w-[140px] animate-pulse rounded-full bg-black/10 md:bg-black/10" />
              ) : isAuthed ? (
                <Link
                  href="/my-content"
                  className="
                    inline-flex h-[44px] items-center justify-center rounded-full px-8
                    text-sm font-semibold
                    border-2 border-black/40
                    bg-white
                    text-black
                    hover:border-black/60
                    hover:bg-black/5
                    transition

                    md:border-black/40
                    md:bg-white
                    md:text-black
                    md:hover:bg-black/5
                  "
                >
                  МИНИЙ КОНТЕНТ
                </Link>
              ) : (
                <button
                  onClick={() => onLogin()}
                  className="
                    inline-flex h-[44px] items-center justify-center rounded-full px-8
                    text-sm font-semibold
                    border-2 border-black/40
                    bg-white
                    text-black
                    hover:border-black/60
                    hover:bg-black/5
                    transition

                    md:border-black/40
                    md:bg-white
                    md:text-black
                    md:hover:bg-black/5
                  "
                >
                  НЭВТРЭХ
                </button>
              )}
            </div>
          </div>

          {/* ✅ SWAP: BENEFITS (was LEFT) -> RIGHT */}
          <div className="order-2 md:order-2">
            <div className="text-lg font-semibold tracking-wide text-black md:text-black">
              MАНАЙ САЙТЫН ДАВУУ ТАЛ
            </div>

            <ul className="mt-6 space-y-3 text-sm md:text-base">
              <li className="flex items-start gap-3 text-black md:text-black">
                <span className="mt-1 h-4 w-4 rounded bg-black md:bg-black" />
                <span>УТСААР / КОМПЬЮТЕРООР ҮЗНЭ</span>
              </li>

              <li className="flex items-start gap-3 text-black md:text-black">
                <span className="mt-[6px] text-black md:text-black">✔</span>
                <span>АНГЛИ ХЭЛ ШААРДЛАГАГҮЙ</span>
              </li>

              <li className="flex items-start gap-3 text-black md:text-black">
                <span className="mt-[6px] text-black md:text-black">✔</span>
                <span>БҮХ ХИЧЭЭЛ МОНГОЛ ХЭЛ ДЭЭР</span>
              </li>

              <li className="flex items-start gap-3 text-black md:text-black">
                <span className="mt-[6px] text-black md:text-black">🤖</span>
                <span>AI AGENT + АВТОМАТЖУУЛАЛТЫГ БОДИТООР</span>
              </li>

              <li className="flex items-start gap-3 text-black md:text-black">
                <span className="mt-[6px] text-black md:text-black">👥</span>
                <span>ХААЛТТАЙ ЧАТ ОРЧИН</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* divider (desktop only) */}
      <div className="mx-auto hidden max-w-6xl px-6 md:block">
        <div className="h-px bg-black/10" />
      </div>
    </section>
  );
}