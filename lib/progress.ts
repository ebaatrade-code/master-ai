export type CourseProgress = {
  byLessonSec: Record<string, number>; // lessonId -> watched seconds
  updatedAt: number; // ms
};

const keyOf = (courseId: string) => `ma_progress_${courseId}`;

export function loadCourseProgress(courseId: string): CourseProgress {
  try {
    const raw = localStorage.getItem(keyOf(courseId));
    if (!raw) return { byLessonSec: {}, updatedAt: Date.now() };
    const parsed = JSON.parse(raw);
    return {
      byLessonSec: parsed?.byLessonSec ?? {},
      updatedAt: Number(parsed?.updatedAt ?? Date.now()),
    };
  } catch {
    return { byLessonSec: {}, updatedAt: Date.now() };
  }
}

export function saveCourseProgress(courseId: string, p: CourseProgress) {
  try {
    localStorage.setItem(keyOf(courseId), JSON.stringify(p));
  } catch {}
}

export function setLessonWatchedSec(courseId: string, lessonId: string, sec: number) {
  const p = loadCourseProgress(courseId);
  const prev = Number(p.byLessonSec?.[lessonId] ?? 0);
  const next = Math.max(prev, Math.floor(sec)); // never decrease
  p.byLessonSec[lessonId] = next;
  p.updatedAt = Date.now();
  saveCourseProgress(courseId, p);
}

export function getLessonWatchedSec(courseId: string, lessonId: string) {
  const p = loadCourseProgress(courseId);
  return Number(p.byLessonSec?.[lessonId] ?? 0);
}

export function calcCoursePercent(params: {
  courseId: string;
  lessons: Array<{ id: string; durationSec?: number }>;
  // optional: if durationSec missing, use a fallback duration
  fallbackDurationSec?: number;
}) {
  const { courseId, lessons } = params;
  const fallback = Math.max(60, Number(params.fallbackDurationSec ?? 300)); // default 5min

  const p = loadCourseProgress(courseId);

  let total = 0;
  let done = 0;

  for (const l of lessons) {
    const dur = Number(l.durationSec);
    const d = Number.isFinite(dur) && dur > 0 ? dur : fallback;

    total += d;

    const watched = Number(p.byLessonSec?.[l.id] ?? 0);
    done += Math.min(watched, d);
  }

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return Math.max(0, Math.min(100, percent));
}

export function isLessonCompleted(params: {
  courseId: string;
  lessonId: string;
  durationSec?: number;
}) {
  const watched = getLessonWatchedSec(params.courseId, params.lessonId);
  const dur = Number(params.durationSec);

  // ✅ 90% буюу 3 мин-ээс дээш үзсэн бол completed гэж тооцъё
  if (Number.isFinite(dur) && dur > 0) return watched >= dur * 0.9;
  return watched >= 180;
}
