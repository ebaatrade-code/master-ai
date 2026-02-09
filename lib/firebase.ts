// lib/firebase.ts (CLIENT SDK)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * ✅ GOAL:
 * - ENV тохируулахгүй байсан ч upload ажиллана
 * - storageBucket үргэлж зөв bucket руу заана
 *
 * ⚠️ Чиний screenshot дээр download URL /b/master-ai-c3860.firebasestorage.app/o/... гэж явж байгаа тул
 * default bucket-ийг яг тэрээр нь тогтвортой өгнө.
 *
 * Хэрвээ чи ирээдүйд өөр project / stage ашиглавал ENV-ээр override хийж болно.
 */

const DEFAULT_PROJECT_ID = "master-ai-c3860";
const DEFAULT_STORAGE_BUCKET = "master-ai-c3860.firebasestorage.app";

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;

const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET;

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDL6-zt-fGIiSX-7xyyqUjNDkrtN_9Yomg",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "master-ai-c3860.firebaseapp.com",
  projectId,

  // ✅ FIX: ENV байхгүй үед ч заавал зөв bucket руу заана
  storageBucket,

  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "955973475140",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:955973475140:web:b228db17e7cd36e9c41511",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ FIX: bucket-аа тодорхой зааж өгнө (upload 0% асуудлыг таслана)
export const storage = getStorage(app, `gs://${storageBucket}`);

export default app;