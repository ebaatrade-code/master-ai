// lib/trackFreeView.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

/**
 * Free lesson view tracking
 */
export async function trackFreeLessonView(params: {
  lessonId: string;
  userId?: string | null;
}) {
  const { lessonId, userId } = params;

  try {
    const ref = doc(db, "freeLessons", lessonId);

    await updateDoc(ref, {
      views: increment(1),
      lastViewedAt: serverTimestamp(),
      ...(userId ? { [`viewedBy.${userId}`]: true } : {}),
    });
  } catch (err) {
    console.error("trackFreeLessonView error:", err);
    // ❗ view tracking унасан ч build унагаах ёсгүй
  }
}
