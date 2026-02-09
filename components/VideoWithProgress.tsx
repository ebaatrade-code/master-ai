"use client";

import { useEffect, useRef } from "react";
import { setLessonWatchedSec } from "@/lib/progress";

type Props = {
  courseId: string;
  lessonId: string;
  src: string;
  poster?: string;
  className?: string;
};

export default function VideoWithLocalProgress({
  courseId,
  lessonId,
  src,
  poster,
  className,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  const lastSavedAt = useRef(0);
  const SAVE_EVERY_MS = 2500; // 2.5сек тутам

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSavedAt.current < SAVE_EVERY_MS) return;

      // video-г ухрааж үзсэн ч буурахгүй (setLessonWatchedSec өөрөө max хийдэг)
      const sec = Math.floor(v.currentTime || 0);
      setLessonWatchedSec(courseId, lessonId, sec);
      lastSavedAt.current = now;
    };

    const onEnded = () => {
      // дууссан үед хамгийн сүүлийн duration хүртэл хадгална
      const dur = Math.floor(v.duration || 0);
      if (dur > 0) setLessonWatchedSec(courseId, lessonId, dur);
    };

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [courseId, lessonId]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      controls
      playsInline
      className={
        className ??
        "w-full rounded-2xl border border-white/10 bg-black/30 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
      }
    />
  );
}
