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

  // ✅ CourseCard-тай ижил base (size, radius, hover animation)
  const cardBase =
    "group block relative overflow-hidden rounded-3xl bg-black/35 backdrop-blur border-2 " +
    "transition-all duration-300 ease-out transform-gpu will-change-transform " +
    "hover:scale-[1.02] hover:-translate-y-1";

  // ✅ Free = RED stroke/glow (Canva шиг stroke мэдрэмжтэй)
  const cardFree =
    "border-red-500/55 shadow-[0_0_18px_rgba(239,68,68,0.25)] " +
    "hover:border-red-300/85 hover:shadow-[0_0_42px_rgba(239,68,68,0.55)]";

  return (
    <CardWrap {...wrapProps} className={`${cardBase} ${cardFree}`}>
      {/* THUMBNAIL (CourseCard-тай адил) */}
      <div className="relative overflow-hidden rounded-t-3xl bg-black/50">
        <div className="aspect-[16/9]">
          {lesson.thumbnailUrl ? (
            <>
              {/* background blur */}
              <img
                src={lesson.thumbnailUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
              />
              <div className="absolute inset-0 bg-black/55" />

              {/* ✅ Hover glow overlay (RED) */}
              <div className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.55),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.25),transparent_60%)]" />

              {/* ✅ Extra bloom blur */}
              <div className="pointer-events-none absolute -inset-8 z-10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle,rgba(239,68,68,0.30),transparent_60%)]" />

              {/* main image */}
              <img
                src={lesson.thumbnailUrl}
                alt={lesson.title}
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

        {/* ✅ Lock badge (top-right) */}
        <div className="absolute right-3 top-3 z-30 rounded-full border border-red-400/30 bg-black/60 px-3 py-1 text-[11px] font-semibold text-red-100/90">
          🔒 Нэвтэрсэн хэрэглэгч
        </div>
      </div>

      {/* BODY (CourseCard-тай адил padding/structure) */}
      <div className="p-4">
        <div className="text-[11px] text-white/55">
          {"2026 • Үнэгүй хичээл"}
        </div>

        <div className="mt-2 text-base font-extrabold text-white/90 line-clamp-1">
          {lesson.title}
        </div>

        {/* shortDescription байхгүй тул CourseCard шиг placeholder мөр үлдээнэ */}
        <div className="mt-2 text-sm text-white/60 line-clamp-2">
          Нэвтэрсэн хэрэглэгч л үзэх боломжтой үнэгүй контент.
        </div>

        {/* PRICE ROW оронд CourseCard-тай ижил өндөр барих хэсэг */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-white">Үнэгүй</div>
            <div className="text-xs text-white/45">Login required</div>
          </div>

          <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-100/80">
            🔒 Free
          </div>
        </div>

        {/* BUTTON (CourseCard-тай яг адил өндөр/радиустай) */}
        <div className="mt-4 w-full rounded-full border-2 border-red-400/55 bg-gradient-to-r from-red-500 to-rose-600 px-5 py-3 text-center text-sm font-extrabold text-white shadow-[0_0_18px_rgba(239,68,68,0.45)] hover:shadow-[0_0_34px_rgba(239,68,68,0.9)] hover:from-red-400 hover:to-rose-500 transition-all duration-300">
          ҮЗЭХ →
        </div>
      </div>
    </CardWrap>
  );
}
