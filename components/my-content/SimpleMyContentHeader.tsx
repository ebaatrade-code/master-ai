"use client";

import Link from "next/link";
import { getContinueWatching } from "@/lib/continue";

type Props = {
  userName?: string | null;
  purchasedCount: number;
};

export default function SimpleMyContentHeader({ userName, purchasedCount }: Props) {
  const { href, title } = getContinueWatching();

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        {/* LEFT */}
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">
            Миний сургалтууд
          </div>

          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            Сайн уу{userName ? `, ${userName}` : ""} 👋
          </div>

          <div className="mt-2 text-sm text-white/65">
            Танд <span className="font-semibold text-white">{purchasedCount}</span> сургалт нээгдсэн байна
          </div>

          {title ? (
            <div className="mt-3 text-sm text-white/60">
              Сүүлд үзсэн:{" "}
              <span className="font-semibold text-white/85">{title}</span>
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/50">
              Та одоогоор хичээл эхлээгүй байна
            </div>
          )}
        </div>

        {/* RIGHT – PRIMARY ACTION */}
        <div className="flex flex-col items-start sm:items-end gap-2">
          <Link
            href={href || "/contents"}
            className="
              inline-flex items-center justify-center
              rounded-full px-8 py-4
              text-base font-extrabold
              bg-gradient-to-r from-green-400 to-orange-600
              text-black
              shadow-[0_0_28px_rgba(251,146,60,0.95)]
              hover:shadow-[0_0_44px_rgba(251,146,60,1)]
              transition-all
            "
          >
             Үргэлжлүүлэх
          </Link>

          <div className="text-xs text-white/50">
            {href ? "Сүүлд үзсэн хичээлээс үргэлжлүүлнэ" : "Боломжит сургалтуудыг үзнэ"}
          </div>
        </div>
      </div>
    </div>
  );
}

