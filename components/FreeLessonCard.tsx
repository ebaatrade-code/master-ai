"use client";

import Link from "next/link";

type FreeLesson = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  createdAt?: any;
};

type Props = {
  lesson: FreeLesson;
  href?: string;
};

export default function FreeLessonCard({ lesson, href }: Props) {
  const CardWrap: any = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  // ✅ MOBILE: white card
  // ✅ DESKTOP (md+): original dark premium card
  const cardBase =
    "group block relative overflow-hidden rounded-3xl " +
    "bg-white border-2 border-black/10 " +
    "transition-all duration-300 ease-out transform-gpu will-change-transform " +
    "hover:scale-[1.02] hover:-translate-y-1 " +
    "md:bg-black/35 md:backdrop-blur md:border-2";

  // ✅ Free = RED stroke/glow (desktop only)
  const cardFree =
    "md:border-red-500/55 md:shadow-[0_0_18px_rgba(239,68,68,0.25)] " +
    "md:hover:border-red-300/85 md:hover:shadow-[0_0_42px_rgba(239,68,68,0.55)]";

  return (
    <CardWrap {...wrapProps} className={`${cardBase} ${cardFree}`}>
      {/* THUMBNAIL */}
      <div className="relative overflow-hidden rounded-t-3xl bg-white md:bg-black/50">
        <div className="aspect-[16/9]">
          {lesson.thumbnailUrl ? (
            <>
              {/* background blur */}
              <img
                src={lesson.thumbnailUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-25 md:opacity-40"
              />
              <div className="absolute inset-0 bg-white/55 md:bg-black/55" />

              {/* ✅ Hover glow overlay (RED) — desktop only */}
              <div className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.55),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.25),transparent_60%)]" />

              {/* ✅ Extra bloom blur — desktop only */}
              <div className="pointer-events-none absolute -inset-8 z-10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 md:bg-[radial-gradient(circle,rgba(239,68,68,0.30),transparent_60%)]" />

              {/* main image */}
              <img
                src={lesson.thumbnailUrl}
                alt={lesson.title}
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

        {/* ✅ Lock badge */}
        <div className="absolute right-3 top-3 z-30 rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-semibold text-black/80 md:border-red-400/30 md:bg-black/60 md:text-red-100/90">
          🔒 Нэвтэрсэн хэрэглэгч
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">
        <div className="text-[11px] text-black/55 md:text-white/55">
          {"2026 • Үнэгүй хичээл"}
        </div>

        <div className="mt-2 text-base font-extrabold text-black/90 line-clamp-1 md:text-white/90">
          {lesson.title}
        </div>

        <div className="mt-2 text-sm text-black/60 line-clamp-2 md:text-white/60">
          Нэвтэрсэн хэрэглэгч л үзэх боломжтой үнэгүй контент.
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-black md:text-white">
              Үнэгүй
            </div>
            <div className="text-xs text-black/45 md:text-white/45">
              Login required
            </div>
          </div>

          <div className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs text-black/70 md:border-red-400/20 md:bg-red-500/10 md:text-red-100/80">
            🔒 Free
          </div>
        </div>

        {/* BUTTON */}
        <div
          className="
            mt-4 w-full rounded-full
            border border-black/15 bg-black px-5 py-3
            text-center text-sm font-extrabold text-white
            shadow-[0_8px_24px_rgba(0,0,0,0.14)]
            hover:opacity-90
            transition-all duration-300

            md:border-2 md:border-red-400/55
            md:bg-gradient-to-r md:from-red-500 md:to-rose-600
            md:shadow-[0_0_18px_rgba(239,68,68,0.45)]
            md:hover:shadow-[0_0_34px_rgba(239,68,68,0.9)]
            md:hover:from-red-400 md:hover:to-rose-500
          "
        >
          ҮЗЭХ →
        </div>
      </div>
    </CardWrap>
  );
}