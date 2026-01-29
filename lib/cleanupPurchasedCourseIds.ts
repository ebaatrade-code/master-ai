"use client";

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * purchasedCourseIds дотор Firestore дээр байхгүй courseId-уудыг цэвэрлэнэ.
 * - users/{uid}.purchasedCourseIds-ийг зөвхөн existingIds болгож overwrite хийнэ.
 */
export async function cleanupPurchasedCourseIds(uid: string, existingIds: string[]) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data() as any;
  const current: string[] = Array.isArray(data?.purchasedCourseIds) ? data.purchasedCourseIds : [];

  // одоогийнх -> зөвхөн Firestore дээр амьд байгаа ID-ууд
  const next = current.filter((id) => existingIds.includes(id));

  // өөрчлөлтгүй бол update хийхгүй
  const same =
    next.length === current.length &&
    next.every((v, i) => v === current[i]);

  if (same) return;

  await updateDoc(userRef, { purchasedCourseIds: next });
}
