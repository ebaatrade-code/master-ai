import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

function parseDurationToDays(input?: string): number | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return null;

  const mDays = s.match(/(\d+)\s*(хоног|өдөр)/);
  if (mDays) return Number(mDays[1]);

  const mMonths = s.match(/(\d+)\s*сар/);
  if (mMonths) return Number(mMonths[1]) * 30;

  const mYears = s.match(/(\d+)\s*жил/);
  if (mYears) return Number(mYears[1]) * 365;

  return null;
}

/**
 * ✅ Admin "гараар нээх" үед ашиглах:
 * @param targetUid - сургалт нээж өгөх хэрэглэгчийн uid
 * @param courseId  - course document id
 * @param override  - хүсвэл гараар хугацаа override хийж болно
 */
export async function grantPurchaseForUser(
  targetUid: string,
  courseId: string,
  override?: { durationDays?: number; durationLabel?: string }
) {
  const uid = String(targetUid ?? "").trim();
  const id = String(courseId ?? "").trim();
  if (!uid) throw new Error("grantPurchaseForUser: targetUid is missing");
  if (!id) throw new Error("grantPurchaseForUser: courseId is missing");

  // ✅ (сонголт) admin login шалгалт – дүрэм чинь Firestore rules дээр хамгаална
  const admin = auth.currentUser;
  if (!admin) throw new Error("Not logged in (admin)");

  // ✅ Course-оос хугацааг бодно
  const courseRef = doc(db, "courses", id);
  const courseSnap = await getDoc(courseRef);

  let durationDays = 30;
  let durationLabel = "30 хоног";

  if (courseSnap.exists()) {
    const c = courseSnap.data() as any;

    const dd = Number(c?.durationDays);
    if (Number.isFinite(dd) && dd > 0) durationDays = dd;
    else {
      const parsed =
        parseDurationToDays(c?.durationLabel) ??
        parseDurationToDays(c?.duration);
      if (parsed && parsed > 0) durationDays = parsed;
    }

    durationLabel =
      String(c?.durationLabel ?? "").trim() ||
      String(c?.duration ?? "").trim() ||
      `${durationDays} хоног`;
  }

  // ✅ override байвал давна
  if (override?.durationDays && Number.isFinite(override.durationDays) && override.durationDays > 0) {
    durationDays = Number(override.durationDays);
  }
  if (override?.durationLabel && String(override.durationLabel).trim()) {
    durationLabel = String(override.durationLabel).trim();
  }

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + durationDays * 24 * 60 * 60 * 1000);

  const userRef = doc(db, "users", uid);

  // ✅ Хэрвээ user doc байхгүй бол эхлээд create маягаар минимал үүсгэнэ
  // (заримдаа auth-аар бүртгэгдээгүй uid орж ирэх үед)
  await setDoc(
    userRef,
    {
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // ✅ Гол засвар: purchases map-ийг бүхлээр нь солихгүй, purchases.{courseId} гэж DOT PATH ашиглана
  await updateDoc(userRef, {
    purchasedCourseIds: arrayUnion(id),
    [`purchases.${id}`]: {
      purchasedAt: serverTimestamp(),
      expiresAt,
      durationDays,
      durationLabel,
    },
    updatedAt: serverTimestamp(),
  });
}

/**
 * ✅ Өөрөө худалдаж авах / mock buy дээр ашиглах shortcut
 * (одоогийн user дээр)
 */
export async function grantPurchase(courseId: string, override?: { durationDays?: number; durationLabel?: string }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not logged in");
  return grantPurchaseForUser(u.uid, courseId, override);
}