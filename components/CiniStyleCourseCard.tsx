"use client";

import Link from "next/link";
import { useMemo } from "react";

type Course = {
  id: string;
  title: string;
  price?: number;
  oldPrice?: number;
  thumbnailUrl?: string;

  durationLabel?: string; // "3 сар" / "30 хоног"
  shortDescription?: string; // card дээрх товч тайлбар
};

const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("mn-MN") : "0";

export default function CiniStyleCourseCard({
  course,
  isPurchased,
}: {
  course: Course;
  isPurchased: boolean;
}) {
  const durationLabel = useMemo(() => (course.durationLabel ?? "").trim(), [course.durationLabel]);
  const shortDescription = useMemo(
    () => (course.shortDescription ?? "").trim(),
    [course.shortDescription]
  );

  const priceNum = Number(course.price ?? 0);
  const priceText =
    Number.isFinite(priceNum) && priceNum > 0 ? `${money(priceNum)}₮ / сар` : "";

  return (
    <Link
      href={`/course/${course.id}`}
      className={[
        "group relative overflow-hidden rounded-3xl",
        "bg-black/30 backdrop-blur transition",
        // ✅ ORANGE NEON STROKE (3px)
        "border-[3px] border-orange-400/55",
        "shadow-[0_0_18px_rgba(255,140,0,0.22)]",
        "hover:border-orange-300/70",
        "hover:shadow-[0_0_34px_rgba(255,140,0,0.45)]",
      ].join(" ")}
    >
      {/* subtle hover glow overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-400/10 via-transparent to-transparent" />
      </div>

      {/* thumbnail */}
      <div className="relative overflow-hidden rounded-t-3xl bg-black/40">
        <div className="aspect-[16/9]">
          {course.thumbnailUrl ? (
            <>
              <img
                src={course.thumbnailUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
              />
              <div className="absolute inset-0 bg-black/45" />
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="relative z-10 h-full w-full object-cover"
                loading="lazy"
              />
            </>
          ) : (
            <div className="grid h-full place-items-center text-black/40">
              <span className="text-sm">Thumbnail байхгүй</span>
            </div>
          )}
        </div>

        {durationLabel ? (
          <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-semibold text-black/80">
            {durationLabel}
          </div>
        ) : null}
      </div>

      {/* body */}
      <div className="p-4">
        <div className="line-clamp-1 text-base font-extrabold text-black/90">
          {course.title}
        </div>

        {shortDescription ? (
          <div className="mt-2 line-clamp-2 text-sm leading-6 text-black/70">
            {shortDescription}
          </div>
        ) : (
          <div className="mt-2 text-sm text-black/40">(Товч тайлбар оруулаагүй)</div>
        )}

        <div className="mt-4 flex items-end justify-between gap-3">
          {!isPurchased ? (
            <>
              <div>
                <div className="text-lg font-extrabold text-black">{priceText}</div>
                {course.oldPrice ? (
                  <div className="text-xs text-black/45 line-through">
                    {money(Number(course.oldPrice))}₮
                  </div>
                ) : null}
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-black/70">
                🔒 Худалдаж аваагүй
              </div>
            </>
          ) : (
            <div className="text-sm text-black/70 group-hover:text-black">Дэлгэрэнгүй →</div>
          )}
        </div>
      </div>
    </Link>
  );
}
