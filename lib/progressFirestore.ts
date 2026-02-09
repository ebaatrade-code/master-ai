// lib/progressFirestore.ts
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export async function upsertLessonProgress(params: {
  uid: string;
  courseId: string;
  lessonId: string;
  watchedSec: number;
  durationSec: number;
  completed: boolean;
}) {
  const { uid, courseId, lessonId, watchedSec, durationSec, completed } = params;

  const ref = doc(db, "users", uid, "courseProgress", courseId, "lessons", lessonId);

  await setDoc(
    ref,
    {
      watchedSec: Math.max(0, Math.floor(watchedSec)),
      durationSec: Math.max(1, Math.floor(durationSec)),
      completed: Boolean(completed),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // optional: parent doc touched
  const parent = doc(db, "users", uid, "courseProgress", courseId);
  await setDoc(parent, { updatedAt: serverTimestamp() }, { merge: true });
}

export async function getCourseProgressDocs(params: {
  uid: string;
  courseId: string;
}) {
  const { uid, courseId } = params;

  const col = collection(db, "users", uid, "courseProgress", courseId, "lessons");
  const snap = await getDocs(col);

  const map: Record<
    string,
    { watchedSec?: number; durationSec?: number; completed?: boolean }
  > = {};

  snap.forEach((d) => {
    map[d.id] = d.data() as any;
  });

  return map;
}
