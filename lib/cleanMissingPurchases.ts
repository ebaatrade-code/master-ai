"use client";

import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function cleanMissingPurchases(uid: string, idsToRemove: string[]) {
  if (!uid) throw new Error("uid is required");
  if (!idsToRemove?.length) return;

  const ref = doc(db, "users", uid);
  // arrayRemove олон аргумент авдаг
  await updateDoc(ref, {
    purchasedCourseIds: arrayRemove(...idsToRemove),
  });
}
