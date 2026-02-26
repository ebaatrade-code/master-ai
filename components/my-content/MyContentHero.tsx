"use client";

import Link from "next/link";

type Props = {
  name: string;
  email: string;
  level: number;
  progressPct: number;
  purchasedCount: number;
  continueHref: string | null;
  continueTitle: string | null;
  accessDaysLeft: number | null;
  onBrowseAll: () => void;
};

function badgeText(level: number) {
  if (level >= 4) return "MASTER";
  if (level === 3) return "PRO";
  if (level === 2) return "CREATOR";
  return "BEGINNER";
}

export default function MyContentHero({
  name,
  email,
  level,
  progressPct,
  purchasedCount,
  continueHref,
  continueTitle,
  accessDaysLeft,
  onBrowseAll,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur p-6 overflow-hidden relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-32 opacity-40 blur-3xl bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.35),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,0.28),transparent_60%)]" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-sm text-black/55">Миний dashboard</div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-2xl font-extrabold text-black/90">
                Сайн уу, {name}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-black/80">
                {badgeText(level)} · Level {level}
              </div>
            </div>

            {email ? (
              <div className="mt-1 text-sm text-black/55">{email}</div>
            ) : null}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-black/75">
              Худалдаж авсан: <span className="font-extrabold">{purchasedCount}</span>
            </div>

            {typeof accessDaysLeft === "number" ? (
              <div
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  accessDaysLeft <= 7
                    ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                    : "border-white/10 bg-white/5 text-black/75"
                }`}
              >
                Access үлдсэн:{" "}
                <span className="font-extrabold">{accessDaysLeft} өдөр</span>
              </div>
            ) : (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-black/50">
                Access мэдээлэл (optional)
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-black/85">
                Ерөнхий ахиц
              </div>
              <div className="mt-1 text-xs text-black/50">
                Энэ бол UX-ын progress. Дараа нь хичээл бүрийн progress-оор илүү
                нарийсгаж болно.
              </div>
            </div>
            <div className="text-lg font-extrabold text-black/90">{progressPct}%</div>
          </div>

          <div className="mt-3 h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-orange-500"
              style={{ width: `${Math.max(6, Math.min(100, progressPct))}%` }}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {continueHref ? (
              <Link
                href={continueHref}
                className="
                  w-full sm:w-auto rounded-full
                  border-2 border-orange-300/40
                  bg-gradient-to-r from-orange-400 to-orange-600
                  px-5 py-3 text-center text-sm font-extrabold text-black
                  shadow-[0_0_22px_rgba(251,146,60,0.85)]
                  hover:shadow-[0_0_36px_rgba(251,146,60,1)]
                  transition-all duration-300
                "
              >
                Үргэлжлүүлэх →
                {continueTitle ? (
                  <span className="ml-2 text-black/70 font-semibold hidden sm:inline">
                    ({continueTitle})
                  </span>
                ) : null}
              </Link>
            ) : (
              <button
                onClick={onBrowseAll}
                className="
                  w-full sm:w-auto rounded-full
                  border-2 border-cyan-400/60
                  bg-gradient-to-r from-cyan-500 to-blue-600
                  px-5 py-3 text-center text-sm font-extrabold text-black
                  shadow-[0_0_18px_rgba(56,189,248,0.55)]
                  hover:shadow-[0_0_34px_rgba(56,189,248,1)]
                  hover:from-cyan-400 hover:to-blue-500
                  transition-all duration-300
                "
              >
                Шинэ сургалт сонгох →
              </button>
            )}

            <button
              onClick={onBrowseAll}
              className="w-full sm:w-auto rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-extrabold text-black/80 hover:bg-white/10 transition"
            >
              Багцууд үзэх →
            </button>
          </div>

          <div className="mt-3 text-xs text-black/40">
            * “Үргэлжлүүлэх” товч гаргахын тулд доорх жижиг helper-ийг course
            үзэх хуудсан дээр 1 мөрөөр тохируулна (дараагийн алхамд өгнө).
          </div>
        </div>
      </div>
    </div>
  );
}
