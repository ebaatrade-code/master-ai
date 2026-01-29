// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ Энд өөрийн firebaseConfig-оо үлдээнэ
const firebaseConfig = {
  apiKey: "AIzaSyDL6-zt-fGIiSX-7xyyqUjNDkrtN_9Yomg",
  authDomain: "master-ai-c3860.firebaseapp.com",
  projectId: "master-ai-c3860",
  storageBucket: "master-ai-c3860.firebasestorage.app",
  messagingSenderId: "955973475140",
  appId: "1:955973475140:web:b228db17e7cd36e9c41511",
};


// ✅ Давхар initialize болохоос хамгаална
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Export-ууд
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
