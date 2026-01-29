// lib/firebaseAdmin.ts
import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin singleton initializer
 * - Build time дээр унахгүй
 * - Runtime дээр env шалгана
 */
function initAdmin(): App {
  // ✅ Аль хэдийн init хийсэн бол reuse
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();

  // ⚠️ Runtime safeguard (build дээр биш)
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// 🔐 Lazy-initialized admin app
const adminApp = initAdmin();

// 🔐 Exports
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
