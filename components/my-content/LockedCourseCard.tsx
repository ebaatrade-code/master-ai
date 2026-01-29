
"use client";


type Course = {
  id: string;
  title?: string;
  category?: string;
  year?: string;
  thumbnailUrl?: string;
  durationLabel?: string;
  shortDescription?: string;
};

type Props = {
  course: Course;
  onUpgrade: () => void;
};

export default function LockedCourseCard({ course, onUpgrade }: Props) {
  return (
    <div
      className="
        group relative overflow-hidden rounded-3xl border-2 border-white/10
        bg-black/35 backdrop-blur
        shadow-[0_0_18px_rgba(255,255,255,0.06)]
      "
    >
      {/* thumb */}
      <div className="relative overflow-hidden rounded-t-3xl bg-black/50">
        <div className="aspect-[16/9]">
          {course.thumbnailUrl ? (
            <>
              <img
                src={course.thumbnailUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-35"
              />
              <div className="absolute inset-0 bg-black/60" />
              <img
                src={course.thumbnailUrl}
                alt={course.title || "Course"}
                className="relative z-10 h-full w-full object-cover opacity-70"
                loading="lazy"
              />
            </>
          ) : (
            <div className="grid h-full place-items-center text-white/40">
              <span className="text-sm">Thumbnail байхгүй</span>
            </div>
          )}
        </div>

        <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/80">
          🔒 Locked
        </div>

        {/* blur overlay */}
        <div className="pointer-events-none absolute inset-0 z-20 backdrop-blur-[2px]" />

        {/* glow hover */}
        <div className="pointer-events-none absolute inset-0 z-30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.45),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.25),transparent_60%)]" />
      </div>

      {/* body */}
      <div className="p-4">
        <div className="text-[11px] text-white/55">
          {(course.year ?? "2025") + " • " + (course.category ?? "Онлайн сургалт")}
        </div>

        <div className="mt-2 text-base font-extrabold text-white/90 line-clamp-1">
          {course.title ?? "Premium багц"}
        </div>

        <div className="mt-2 text-sm leading-6 text-white/65 line-clamp-2">
          {course.shortDescription?.trim()
            ? course.shortDescription.trim()
            : "Энэ багц таны дараагийн түвшинд хамгийн тохиромжтой."}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            Unlock хийх → Upgrade
          </div>

          <button
            onClick={onUpgrade}
            className="
              rounded-full border border-orange-300/40 bg-orange-500/10
              px-4 py-2 text-xs font-extrabold text-orange-200
              hover:bg-orange-500/15 transition
            "
          >
            Одоо нээх →
          </button>
        </div>
      </div>
    </div>
  );
}
