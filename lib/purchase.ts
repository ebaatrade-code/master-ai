import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export async function grantPurchase(courseId: string) {
  const id = String(courseId ?? "").trim();
  if (!id) throw new Error("grantPurchase: courseId is missing/invalid");

  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");

  const userRef = doc(db, "users", u.uid);

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + 30 * 24 * 60 * 60 * 1000); // ✅ 30 хоног

  await setDoc(
    userRef,
    {
      email: u.email ?? "",
      purchasedCourseIds: arrayUnion(id),
      purchases: {
        [id]: {
          purchasedAt: serverTimestamp(),
          expiresAt,
          durationDays: 30,
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
