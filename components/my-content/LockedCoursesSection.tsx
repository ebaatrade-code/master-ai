"use client";

import LockedCourseCard from "./LockedCourseCard";


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
  level: number;
  loading: boolean;
  lockedCourses: Course[];
  onUpgrade: () => void;
};

export default function LockedCoursesSection({
  level,
  loading,
  lockedCourses,
  onUpgrade,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold text-white/90">
            🔒 Дараагийн түвшинд нээгдэх сургалтууд
          </div>
          <div className="mt-1 text-sm text-white/55">
            Level {level} дээрээ үргэлжлүүлээд ахих тусам илүү олон premium багц нээгдэнэ.
          </div>
        </div>

        <button
          onClick={onUpgrade}
          className="
            w-full sm:w-auto rounded-full
            border-2 border-orange-300/40
            bg-gradient-to-r from-orange-400 to-orange-600
            px-6 py-3 text-center text-sm font-extrabold text-black
            shadow-[0_0_22px_rgba(251,146,60,0.85)]
            hover:shadow-[0_0_36px_rgba(251,146,60,1)]
            transition-all duration-300
          "
        >
          Одоо нээх →
        </button>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Санал болгох багцуудыг уншиж байна...
        </div>
      ) : lockedCourses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Одоогоор санал болгох locked контент олдсонгүй.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lockedCourses.map((c) => (
            <LockedCourseCard key={c.id} course={c} onUpgrade={onUpgrade} />
          ))}
        </div>
      )}
    </div>
  );
}
