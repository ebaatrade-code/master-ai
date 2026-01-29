import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

/**
 * Free lesson үзэлт бүрийг бүртгэнэ.
 * Firestore: freeLessonViews collection
 */
export async function trackFreeLessonView(lessonId: string) {
  const u = auth.currentUser;
  if (!u) return;
  if (!lessonId) return;

  try {
    await addDoc(collection(db, "freeLessonViews"), {
      userId: u.uid,
      lessonId,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("trackFreeLessonView error:", e);
  }
}
