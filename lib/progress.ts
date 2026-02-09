// lib/progress.ts
"use client";

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, Unsubscribe } from "firebase/firestore";

export type CourseProgress = {
  byLessonSec: Record<string, number>; // lessonId -> watched seconds
  lastLessonId?: string;
  updatedAt?: any; // Firestore Timestamp
};

// =====================
// LocalStorage (optional, fallback)
// =====================
const keyOf = (courseId: string) => `ma_progress_${courseId}`;

export function loadCourseProgressLocal(courseId: string): CourseProgress {
  try {
    const raw = localStorage.getItem(keyOf(courseId));
    if (!raw) return { byLessonSec: {} };
    const parsed = JSON.parse(raw);
    return {
      byLessonSec: parsed?.byLessonSec ?? {},
      lastLessonId: parsed?.lastLessonId ?? "",
      updatedAt: parsed?.updatedAt,
    };
  } catch {
    return { byLessonSec: {} };
  }
}

export function saveCourseProgressLocal(courseId: string, p: CourseProgress) {
  try {
    localStorage.setItem(keyOf(courseId), JSON.stringify(p));
  } catch {}
}

export function setLessonWatchedSecLocal(courseId: string, lessonId: string, sec: number) {
  const p = loadCourseProgressLocal(courseId);
  const prev = Number(p.byLessonSec?.[lessonId] ?? 0);
  const next = Math.max(prev, Math.floor(sec)); // never decrease
  p.byLessonSec[lessonId] = next;
  p.lastLessonId = lessonId;
  saveCourseProgressLocal(courseId, p);
}

// =====================
// Firestore
// users/{uid}/courseProgress/{courseId}
// =====================
const progressDocRef = (uid: string, courseId: string) => doc(db, "users", uid, "courseProgress", courseId);

export async function getCourseProgressFS(uid: string, courseId: string): Promise<CourseProgress> {
  const snap = await getDoc(progressDocRef(uid, courseId));
  if (!snap.exists()) return { byLessonSec: {} };
  const d = snap.data() as any;

  // ✅ string -> number safeguard
  const raw = (d?.byLessonSec ?? {}) as Record<string, any>;
  const fixed: Record<string, number> = {};
  for (const k of Object.keys(raw)) {
    const v = Number(raw[k] ?? 0);
    fixed[k] = Number.isFinite(v) ? v : 0;
  }

  return {
    byLessonSec: fixed,
    lastLessonId: (d?.lastLessonId ?? "") as string,
    updatedAt: d?.updatedAt,
  };
}

// ✅ нэг lesson-ийн watched seconds update хийх (merge)
// ⚠️ setDoc дээр dot-path ашиглавал nested биш "string field" болж магадгүй.
// Тиймээс byLessonSec map-ийг merge хийж бичнэ.
export async function setLessonWatchedSecFS(params: {
  uid: string;
  courseId: string;
  lessonId: string;
  sec: number;
}) {
  const { uid, courseId, lessonId, sec } = params;

  await setDoc(
    progressDocRef(uid, courseId),
    {
      byLessonSec: {
        [lessonId]: Math.floor(sec),
      },
      lastLessonId: lessonId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ✅ realtime сонсох (my-content дээр ашиглана)
export function listenCourseProgressFS(params: {
  uid: string;
  courseId: string;
  onChange: (p: CourseProgress) => void;
}): Unsubscribe {
  const { uid, courseId, onChange } = params;

  return onSnapshot(progressDocRef(uid, courseId), (snap) => {
    if (!snap.exists()) {
      onChange({ byLessonSec: {} });
      return;
    }
    const d = snap.data() as any;

    // ✅ string -> number safeguard
    const raw = (d?.byLessonSec ?? {}) as Record<string, any>;
    const fixed: Record<string, number> = {};
    for (const k of Object.keys(raw)) {
      const v = Number(raw[k] ?? 0);
      fixed[k] = Number.isFinite(v) ? v : 0;
    }

    onChange({
      byLessonSec: fixed,
      lastLessonId: (d?.lastLessonId ?? "") as string,
      updatedAt: d?.updatedAt,
    });
  });
}

// =====================
// Percent calculators
// =====================

// ✅ 100% гацахаас хамгаалсан SNAP логик (жижиг үлдэгдэл секундээс болж 99% дээр гацахгүй)
function snapTo100(done: number, total: number) {
  if (total <= 0) return false;
  return done / total >= 0.995; // 99.5%+ бол 100 гэж үзнэ
}

export function calcCoursePercentFromProgress(params: {
  progress: CourseProgress | null | undefined;
  lessons: Array<{ id: string; durationSec?: number }>;
  fallbackDurationSec?: number;
}) {
  const fallback = Math.max(60, Number(params.fallbackDurationSec ?? 300)); // default 5min
  const lessons = params.lessons ?? [];
  const by = params.progress?.byLessonSec ?? {};

  let total = 0;
  let done = 0;

  for (const l of lessons) {
    const dur = Number(l.durationSec);
    const d = Number.isFinite(dur) && dur > 0 ? dur : fallback;

    total += d;

    const watched = Number(by?.[l.id] ?? 0);
    done += Math.min(watched, d);
  }

  if (snapTo100(done, total)) return 100;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return Math.max(0, Math.min(100, percent));
}

export function isLessonCompleted(params: {
  progress: CourseProgress | null | undefined;
  lessonId: string;
  durationSec?: number;
}) {
  const watched = Number(params.progress?.byLessonSec?.[params.lessonId] ?? 0);
  const dur = Number(params.durationSec);

  // ✅ 90% эсвэл 3 минут
  if (Number.isFinite(dur) && dur > 0) return watched >= dur * 0.9;
  return watched >= 180;
}

// =====================
// ✅ Backward-compatible exports (хуучин код эвдэхгүй)
// =====================

/**
 * Хуучин нэр: setLessonWatchedSec(courseId, lessonId, sec)
 * - default: localStorage-д хадгална
 * - хэрвээ uid өгвөл Firestore-д мөн бичнэ
 */
export async function setLessonWatchedSec(courseId: string, lessonId: string, sec: number, uid?: string) {
  // local fallback
  setLessonWatchedSecLocal(courseId, lessonId, sec);

  // optional Firestore write
  if (uid) {
    await setLessonWatchedSecFS({
      uid,
      courseId,
      lessonId,
      sec,
    });
  }
}

/**
 * Хуучин нэр: calcCourseStats(...)
 * Одоо: localStorage-аас зөв key-ээр уншина (ma_progress_{courseId})
 */
export function calcCourseStats(params: {
  courseId: string;
  lessons: Array<{ id: string; durationSec?: number }>;
  fallbackDurationSec?: number;
}) {
  // ✅ localStorage progress-оо зөв key-ээр уншина
  const progress = loadCourseProgressLocal(params.courseId);

  const percent = calcCoursePercentFromProgress({
    lessons: params.lessons ?? [],
    progress,
    fallbackDurationSec: params.fallbackDurationSec ?? 300,
  });

  const totalLessons = (params.lessons ?? []).length;
  let completedLessons = 0;

  for (const l of params.lessons ?? []) {
    if (
      isLessonCompleted({
        progress,
        lessonId: l.id,
        durationSec: l.durationSec,
      })
    ) {
      completedLessons += 1;
    }
  }

  return { percent, totalLessons, completedLessons };
}
