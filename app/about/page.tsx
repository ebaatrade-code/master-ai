"use client";

import Link from "next/link";

const BAR_HEIGHTS = [28, 38, 32, 50, 42, 58, 50, 68, 60, 78, 68, 92];

const STATS = [
  {
    bg: "#fce7f3",
    stroke: "#ec4899",
    text: "50+ сургалт бэлэн байна",
    icon: "bolt",
  },
  {
    bg: "#fff7ed",
    stroke: "#f97316",
    text: "98% сэтгэл ханамж",
    icon: "star",
  },
  {
    bg: "#e0f2fe",
    stroke: "#0ea5e9",
    text: "24/7 хүссэн цагтаа сурах боломж",
    icon: "clock",
  },
];

const FEATURES = [
  {
    bg: "#fff7ed",
    stroke: "#f97316",
    title: "Контент бүтээх",
    desc: "Видео, зураг, текст контентоо AI-р мэргэжлийн түвшинд бүтээ",
    icon: "grid",
  },
  {
    bg: "#eff6ff",
    stroke: "#3b82f6",
    title: "Автоматжуулах",
    desc: "Давтагдах ажлуудаа AI-р автоматжуулж, цагаа хэмнэ",
    icon: "sparkle",
  },
  {
    bg: "#f0fdfa",
    stroke: "#14b8a6",
    title: "Бүтээмж ×10",
    desc: "AI хэрэгслүүдийг нэвтрүүлж бүтээмжээ арав дахин өсгө",
    icon: "bolt",
  },
];

function BoltIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function StarIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function ClockIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function GridIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function SparkleIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  );
}
function BoltIconLg({ stroke }: { stroke: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <main style={{ background: "#f4f1ec", minHeight: "100vh" }}>
      <style>{`
        @keyframes orbitCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbitCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%     { box-shadow: 0 0 0 14px rgba(124,58,237,0); }
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-4 pt-20 pb-24 sm:px-6">

        {/* ── LABEL ── */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div style={{ height: "1px", width: "56px", background: "linear-gradient(to right, transparent, #a78bfa)" }} />
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.22em", color: "#7c3aed" }}>
            БИДНИЙ ТУХАЙ
          </span>
          <div style={{ height: "1px", width: "56px", background: "linear-gradient(to left, transparent, #a78bfa)" }} />
        </div>

        {/* ── HEADING ── */}
        <h1
          className="text-center font-extrabold tracking-tight leading-[1.12]"
          style={{ fontSize: "clamp(34px, 6vw, 50px)", color: "#0f0d1a", marginBottom: "20px" }}
        >
          AI-г{" "}
          <span style={{
            textDecoration: "underline",
            textDecorationColor: "#f43f5e",
            textDecorationThickness: "3px",
            textUnderlineOffset: "6px",
          }}>мэддэг</span>
          {" "}биш,
          <br />
          бодитоор{" "}
          <span style={{
            textDecoration: "underline",
            textDecorationColor: "#8b5cf6",
            textDecorationThickness: "3px",
            textUnderlineOffset: "6px",
          }}>хийдэг</span>
          {" "}болго
        </h1>

        {/* ── SUBTITLE ── */}
        <p
          className="text-center"
          style={{ color: "#6b7280", fontSize: "15px", lineHeight: 1.75, maxWidth: "700px", margin: "0 auto 48px" }}
        >
          Master AI бол Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн
          сургалтын платформ. Ажлын бүтээмжийг нэмэх, контент үйлдвэрлэх,
          автоматжуулах ур чадварыг ойлгомжтой байдлаар хүргэнэ.
        </p>

        {/* ── BENTO GRID ── */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)",
            gridTemplateRows: "auto auto",
          }}
        >
          {/* LEFT dark card — spans both rows */}
          <div
            style={{
              gridRow: "1 / 3",
              background: "linear-gradient(145deg, #1c1545 0%, #2b1b61 55%, #1e2050 100%)",
              borderRadius: "24px",
              minHeight: "380px",
              position: "relative",
              overflow: "hidden",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            {/* subtle noise overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 40%, rgba(109,40,217,0.25) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* ── ORBIT ── */}
            <div style={{ position: "absolute", top: "42%", left: "50%", transform: "translate(-50%, -50%)" }}>
              {/* Rings */}
              <div style={{ position: "absolute", width: "152px", height: "152px", transform: "translate(-50%,-50%)", border: "1px dashed rgba(255,255,255,0.18)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", width: "202px", height: "202px", transform: "translate(-50%,-50%)", border: "1px dashed rgba(255,255,255,0.10)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", width: "254px", height: "254px", transform: "translate(-50%,-50%)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "50%" }} />

              {/* Center icon */}
              <div style={{
                position: "absolute",
                width: "64px", height: "64px",
                transform: "translate(-50%,-50%)",
                background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                borderRadius: "18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "26px",
                boxShadow: "0 0 0 0 rgba(124,58,237,0.4)",
                animation: "pulseGlow 2.5s ease-in-out infinite",
                zIndex: 2,
              }}>
                👆
              </div>

              {/* Dot 1 — orange, r = 76px */}
              <div style={{ position: "absolute", top: 0, left: 0, animation: "orbitCW 6s linear infinite", transformOrigin: "0 0" }}>
                <div style={{ position: "absolute", transform: "translate(76px,-5px)", width: "10px", height: "10px", borderRadius: "50%", background: "#fb923c", boxShadow: "0 0 8px #fb923c, 0 0 18px rgba(251,146,60,0.45)" }} />
              </div>

              {/* Dot 2 — blue, r = 101px */}
              <div style={{ position: "absolute", top: 0, left: 0, animation: "orbitCW 10s linear infinite", animationDelay: "-4s", transformOrigin: "0 0" }}>
                <div style={{ position: "absolute", transform: "translate(101px,-4px)", width: "8px", height: "8px", borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 8px #60a5fa, 0 0 18px rgba(96,165,250,0.45)" }} />
              </div>

              {/* Dot 3 — teal, r = 127px, counter-clockwise */}
              <div style={{ position: "absolute", top: 0, left: 0, animation: "orbitCCW 15s linear infinite", animationDelay: "-8s", transformOrigin: "0 0" }}>
                <div style={{ position: "absolute", transform: "translate(127px,-4px)", width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80, 0 0 18px rgba(74,222,128,0.45)" }} />
              </div>
            </div>

            {/* Bottom label */}
            <div style={{ position: "relative", zIndex: 3 }}>
              <div style={{ fontWeight: 800, fontSize: "18px", color: "#fff", lineHeight: 1.3 }}>
                Хиймэл оюун ухааны платформ
              </div>
              <div style={{ marginTop: "7px", fontSize: "13px", color: "rgba(255,255,255,0.48)", lineHeight: 1.55 }}>
                Таны ирээдүйн ажлын хэрэгсэл — AI-г эзэмшиж, бодит үр дүнд хүрээрэй
              </div>
            </div>
          </div>

          {/* TOP RIGHT — Stat + mini chart */}
          <div style={{ background: "#fff", borderRadius: "24px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{
              fontSize: "54px", fontWeight: 900, lineHeight: 1,
              background: "linear-gradient(130deg, #ec4899 0%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              1,432
            </div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", color: "#9ca3af", marginTop: "5px", textTransform: "uppercase" }}>
              Суралцагч
            </div>

            {/* Bar chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "52px", marginTop: "18px" }}>
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    background: "linear-gradient(to top, #ec4899, #a855f7)",
                    borderRadius: "3px 3px 0 0",
                    opacity: 0.35 + i * 0.056,
                  }}
                />
              ))}
            </div>
          </div>

          {/* BOTTOM RIGHT — Mini stats list */}
          <div style={{ background: "#fff", borderRadius: "24px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            {STATS.map((s, i) => (
              <div key={s.text}>
                {i > 0 && <div style={{ height: "1px", background: "#f3f4f6", margin: "11px 0" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "10px",
                    background: s.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {s.icon === "bolt"  && <BoltIcon  stroke={s.stroke} />}
                    {s.icon === "star"  && <StarIcon  stroke={s.stroke} />}
                    {s.icon === "clock" && <ClockIcon stroke={s.stroke} />}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151", lineHeight: 1.4 }}>
                    {s.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURE CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{ background: "#fff", borderRadius: "24px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >
              <div style={{
                width: "44px", height: "44px", borderRadius: "14px",
                background: f.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "16px",
              }}>
                {f.icon === "grid"    && <GridIcon    stroke={f.stroke} />}
                {f.icon === "sparkle" && <SparkleIcon stroke={f.stroke} />}
                {f.icon === "bolt"    && <BoltIconLg  stroke={f.stroke} />}
              </div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>{f.title}</div>
              <div style={{ marginTop: "8px", fontSize: "13px", color: "#9ca3af", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* ── CTA BUTTONS ── */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          <Link
            href="/contents"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "#111827", color: "#fff",
              borderRadius: "999px", padding: "13px 30px",
              fontSize: "14px", fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Сургалт үзэх →
          </Link>
          <Link
            href="/request"
            style={{
              display: "inline-flex", alignItems: "center",
              background: "#fff", color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: "999px", padding: "13px 30px",
              fontSize: "14px", fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Асуудал шийдүүлэх
          </Link>
        </div>

      </div>
    </main>
  );
}
