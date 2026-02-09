// components/HeroAgentSection.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

type Props = {
  isAuthed: boolean;
  loadingAuth: boolean;
  onLogin: () => void;
};

export default function HeroAgentSection({
  isAuthed,
  loadingAuth,
  onLogin,
}: Props) {
  // ✅ 3D TILT state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height; // 0..1

    const ry = (x - 0.5) * 10; // rotateY
    const rx = (0.5 - y) * 10; // rotateX

    setTilt({ rx, ry });
  };

  const onCardLeave = () => setTilt({ rx: 0, ry: 0 });

  return (
    // ✅ FIX: HERO-ийн desktop background-ыг transparent болгож layout-ын premium фонтой нэгтгэнэ
    <section className="relative w-full overflow-hidden bg-white text-black md:bg-transparent md:text-white">
      {/* ✅ HERO BACKGROUND IMAGE REMOVED (арын зураг байхгүй) */}
      {/*
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] md:block">
        <Image
          src="/hero/hero-bg.png"
          alt="AI vs Human"
          fill
          priority
          className="object-cover"
          style={{ objectPosition: "70% 40%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/10 via-black/55 to-[#0b0d10]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0b0d10]" />
      </div>
      */}

      {/* Ambient glow accents (desktop only – mobile white дээр “бохир” харагддаг) */}
      <div className="pointer-events-none absolute -left-32 top-24 hidden h-[420px] w-[420px] rounded-full bg-cyan-500/15 blur-[160px] md:block" />
      <div className="pointer-events-none absolute right-[-160px] top-[-120px] hidden h-[480px] w-[480px] rounded-full bg-fuchsia-500/15 blur-[180px] md:block" />

      {/* CONTENT */}
      <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6 md:pt-20 md:pb-14">
        <div className="grid items-center gap-8 md:gap-12 md:grid-cols-2">
          {/* LEFT TEXT */}
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold leading-[1.15] text-black md:text-white">
              АЖИЛ ХИЙХҮҮ{" "}
              <span className="text-orange-500 md:text-orange-400">AI AGENT</span>
              <br />
              АЖЛУУЛАХ УУ!
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-black/70 md:text-white/75 md:text-lg">
              2026 онд контент, судалгаа, маркетинг зэрэг давтагддаг ажлуудыг AI
              Agent-ууд гүйцэтгэнэ. Чи сураад ажлаа AI Agent-ээр хийлгэх үү,
              эсвэл өөрөө бүхнийг гараараа хийсээр үлдэх үү?
            </p>

            {/* BENEFITS */}
            <div className="mt-10">
              <div className="text-lg font-semibold tracking-wide text-black/85 md:text-white/85">
                ДАВУУ ТАЛ
              </div>

              <ul className="mt-4 space-y-3 text-sm md:text-base">
                <li className="flex items-start gap-3 text-black/75 md:text-white/80">
                  <span className="mt-1 h-4 w-4 rounded bg-cyan-500/80 md:bg-cyan-400/90" />
                  <span>УТСААР / КОМПЬЮТЕРООР ҮЗНЭ</span>
                </li>

                <li className="flex items-start gap-3 text-black/75 md:text-white/80">
                  <span className="mt-[6px] text-black/45 md:text-white/60">✔</span>
                  <span>АНГЛИ ХЭЛ ШААРДЛАГАГҮЙ</span>
                </li>

                <li className="flex items-start gap-3 text-black/75 md:text-white/80">
                  <span className="mt-[6px] text-black/45 md:text-white/60">✔</span>
                  <span>БҮХ ХИЧЭЭЛ МОНГОЛ ХЭЛ ДЭЭР</span>
                </li>

                <li className="flex items-start gap-3 text-black/75 md:text-white/80">
                  <span className="mt-[6px] text-black/45 md:text-white/60">🤖</span>
                  <span>AI AGENT + АВТОМАТЖУУЛАЛТЫГ БОДИТООР</span>
                </li>

                <li className="flex items-start gap-3 text-black/75 md:text-white/80">
                  <span className="mt-[6px] text-black/45 md:text-white/60">👥</span>
                  <span>ХААЛТТАЙ ЧАТ ОРЧИН</span>
                </li>
              </ul>
            </div>

            {/* ACTIONS */}
            <div className="mt-12 flex flex-wrap gap-4">
              <a
                href="#contents"
                className="rounded-full bg-black px-8 py-3 text-sm font-semibold text-white hover:opacity-90 md:bg-white md:text-black"
              >
                КОНТЕНТ ҮЗЭХ
              </a>

              {loadingAuth ? (
                <div className="h-[44px] w-[140px] animate-pulse rounded-full bg-black/10 md:bg-white/10" />
              ) : isAuthed ? (
                <Link
                  href="/my-content"
                  className="rounded-full border border-black/15 bg-black/5 px-8 py-3 text-sm font-semibold text-black hover:bg-black/10 md:border-white/25 md:bg-white/10 md:text-white md:hover:bg-white/15"
                >
                  МИНИЙ КОНТЕНТ
                </Link>
              ) : (
                <button
                  onClick={onLogin}
                  className="rounded-full border border-black/15 bg-black/5 px-8 py-3 text-sm font-semibold text-black hover:bg-black/10 md:border-white/25 md:bg-white/10 md:text-white md:hover:bg-white/15"
                >
                  НЭВТРЭХ
                </button>
              )}
            </div>
          </div>

          {/* RIGHT IMAGE CARD (MASK + GLOW + BORDER) + ✅ 3D TILT */}
          <div
            className="relative mx-auto w-full max-w-[360px] sm:max-w-[420px] md:max-w-[520px]"
            style={{ perspective: "1200px" }}
          >
            {/* ✅ Soft outer glow (desktop only) */}
            <div className="pointer-events-none absolute -inset-10 -z-10 hidden rounded-[44px] bg-gradient-to-br from-cyan-500/18 via-fuchsia-500/14 to-orange-500/18 blur-[46px] md:block" />

            {/* ✅ extra subtle base bloom (desktop only) */}
            <div className="pointer-events-none absolute -inset-6 -z-10 hidden rounded-[40px] bg-white/5 blur-[26px] md:block" />

            {/* frame */}
            <div
              ref={cardRef}
              onMouseMove={onCardMove}
              onMouseLeave={onCardLeave}
              className="relative rounded-[28px] transition-transform duration-150 ease-out will-change-transform md:hover:cursor-pointer"
              style={{
                transform:
                  typeof window !== "undefined" &&
                  window.matchMedia?.("(max-width: 767px)")?.matches
                    ? "none"
                    : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
              }}
            >
              {/* ✅ Premium border ring */}
              <div className="absolute -inset-[1px] rounded-[30px] bg-gradient-to-br from-black/10 via-black/5 to-black/10 md:from-white/18 md:via-white/6 md:to-white/12" />

              {/* ✅ Inner panel */}
              <div className="relative overflow-hidden rounded-[28px] bg-black/10 shadow-[0_30px_140px_rgba(0,0,0,0.20)] md:bg-black/30 md:shadow-[0_30px_140px_rgba(0,0,0,0.85)]">
                <Image
                  src="/hero/galzuu.png"
                  alt="AI vs Human"
                  width={1200}
                  height={1600}
                  priority
                  className="h-auto w-full select-none object-cover"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.9) 78%, rgba(0,0,0,0.55) 88%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.9) 78%, rgba(0,0,0,0.55) 88%, rgba(0,0,0,0) 100%)",
                  }}
                />

                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-0 top-0 hidden h-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent md:block" />
                  <div className="absolute inset-x-0 bottom-0 hidden h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent md:block" />
                  <div className="absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-black/55 via-black/20 to-transparent md:block" />
                  <div className="absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-black/55 via-black/20 to-transparent md:block" />
                  <div className="absolute inset-0 hidden [box-shadow:inset_0_0_160px_rgba(0,0,0,0.78)] md:block" />
                  <div className="absolute inset-0 rounded-[28px] ring-1 ring-black/10 md:ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* divider (desktop only – mobile white дээр хэрэггүй) */}
      <div className="mx-auto hidden max-w-6xl px-6 md:block">
        <div className="h-px bg-white/10" />
      </div>
    </section>
  );
}