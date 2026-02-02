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
    <section className="relative w-full overflow-hidden bg-[#0b0d10]">
      {/* RIGHT SIDE BACKGROUND ART (masked, not full bleed) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] md:block">
        <Image
          src="/hero/hero-bg.png"
          alt="AI vs Human"
          fill
          priority
          className="object-cover"
          style={{ objectPosition: "70% 40%" }}
        />

        {/* Fade to left for text readability */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/10 via-black/55 to-[#0b0d10]" />

        {/* Bottom fade into next section */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0b0d10]" />
      </div>

      {/* Ambient glow accents */}
      <div className="pointer-events-none absolute -left-32 top-24 h-[420px] w-[420px] rounded-full bg-cyan-500/15 blur-[160px]" />
      <div className="pointer-events-none absolute right-[-160px] top-[-120px] h-[480px] w-[480px] rounded-full bg-fuchsia-500/15 blur-[180px]" />

      {/* CONTENT */}
      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-20 md:pb-14">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* LEFT TEXT */}
          <div>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-6xl">
              АЖИЛ ХИЙХҮҮ{" "}
              <span className="text-orange-400">AI AGENT</span>
              <br />
              АЖЛУУЛАХ УУ!
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 md:text-lg">
              2026 онд контент, судалгаа, маркетинг зэрэг давтагддаг ажлуудыг AI
              Agent-ууд гүйцэтгэнэ. Чи сураад ажлаа AI Agent-ээр хийлгэх үү,
              эсвэл өөрөө бүхнийг гараараа хийсээр үлдэх үү?
            </p>

            {/* BENEFITS */}
            <div className="mt-10">
              <div className="text-lg font-semibold tracking-wide text-white/85">
                ДАВУУ ТАЛ
              </div>

              <ul className="mt-4 space-y-3 text-sm md:text-base">
                <li className="flex items-start gap-3 text-white/80">
                  <span className="mt-1 h-4 w-4 rounded bg-cyan-400/90" />
                  <span>УТСААР / КОМПЬЮТЕРООР ҮЗНЭ</span>
                </li>

                <li className="flex items-start gap-3 text-white/80">
                  <span className="mt-[6px] text-white/60">✔</span>
                  <span>АНГЛИ ХЭЛ ШААРДЛАГАГҮЙ</span>
                </li>

                <li className="flex items-start gap-3 text-white/80">
                  <span className="mt-[6px] text-white/60">✔</span>
                  <span>БҮХ ХИЧЭЭЛ МОНГОЛ ХЭЛ ДЭЭР</span>
                </li>

                <li className="flex items-start gap-3 text-white/80">
                  <span className="mt-[6px] text-white/60">🤖</span>
                  <span>AI AGENT + АВТОМАТЖУУЛАЛТЫГ БОДИТООР</span>
                </li>

                <li className="flex items-start gap-3 text-white/80">
                  <span className="mt-[6px] text-white/60">👥</span>
                  <span>ХААЛТТАЙ ЧАТ ОРЧИН</span>
                </li>
              </ul>
            </div>

            {/* ACTIONS */}
            <div className="mt-12 flex flex-wrap gap-4">
              <a
                href="#contents"
                className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black hover:opacity-90"
              >
                КОНТЕНТ ҮЗЭХ
              </a>

              {loadingAuth ? (
                <div className="h-[44px] w-[140px] animate-pulse rounded-full bg-white/10" />
              ) : isAuthed ? (
                <Link
                  href="/my-content"
                  className="rounded-full border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  МИНИЙ КОНТЕНТ
                </Link>
              ) : (
                <button
                  onClick={onLogin}
                  className="rounded-full border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  НЭВТРЭХ
                </button>
              )}
            </div>
          </div>

          {/* RIGHT IMAGE CARD (MASK + GLOW + BORDER) + ✅ 3D TILT */}
          <div
            className="relative mx-auto w-full max-w-[520px]"
            style={{ perspective: "1200px" }}
          >
            {/* ✅ Soft outer glow (clean, not too loud) */}
            <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[44px] bg-gradient-to-br from-cyan-500/18 via-fuchsia-500/14 to-orange-500/18 blur-[46px]" />

            {/* ✅ extra subtle base bloom */}
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-white/5 blur-[26px]" />

            {/* frame */}
            <div
              ref={cardRef}
              onMouseMove={onCardMove}
              onMouseLeave={onCardLeave}
              className="relative rounded-[28px] transition-transform duration-150 ease-out will-change-transform"
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
              }}
            >
              {/* ✅ Premium border (outer gradient ring) */}
              <div className="absolute -inset-[1px] rounded-[30px] bg-gradient-to-br from-white/18 via-white/6 to-white/12" />

              {/* ✅ Inner panel */}
              <div className="relative overflow-hidden rounded-[28px] bg-black/30 shadow-[0_30px_140px_rgba(0,0,0,0.85)]">
                {/* ✅ Image with MASK (uusah irmeg) */}
                <Image
                  src="/hero/galzuu.png"
                  alt="AI vs Human"
                  width={1200}
                  height={1600}
                  priority
                  className="h-auto w-full select-none object-cover"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.92) 72%, rgba(0,0,0,0.55) 84%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.92) 72%, rgba(0,0,0,0.55) 84%, rgba(0,0,0,0) 100%)",
                  }}
                />

                {/* ✅ Soft edge blend + vignette (наалдацтай) */}
                <div className="pointer-events-none absolute inset-0">
                  {/* Top/Bottom blend */}
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                  {/* Left/Right blend */}
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
                  <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/55 via-black/20 to-transparent" />

                  {/* subtle vignette */}
                  <div className="absolute inset-0 [box-shadow:inset_0_0_160px_rgba(0,0,0,0.78)]" />

                  {/* ✅ inner border ring (clean) */}
                  <div className="absolute inset-0 rounded-[28px] ring-1 ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/10" />
      </div>
    </section>
  );
}
