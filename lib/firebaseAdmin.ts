// lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

function getPrivateKey() {
  const k = process.env.FIREBASE_PRIVATE_KEY;
  if (!k) return undefined;
  return k.replace(/\\n/g, "\n");
}

/**
 * Required env:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 *
 * Optional env:
 * - FIREBASE_STORAGE_BUCKET
 * - FIREBASE_DATABASE_URL
 */
export function adminApp() {
  // ✅ TS null-safe: apps list дотор null байж магадгүй гэж үздэг тул optional chaining ашиглав
  const existing = admin.apps.find((app) => app?.name === "__admin__");
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET; // optional
  const databaseURL = process.env.FIREBASE_DATABASE_URL; // optional

  return admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      ...(storageBucket ? { storageBucket } : {}),
      ...(databaseURL ? { databaseURL } : {}),
    },
    "__admin__"
  );
}

export function adminAuth() {
  return adminApp().auth();
}

export function adminDb() {
  return adminApp().firestore();
}