"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = "admin" | "user";
type AccountStatus = "active" | "suspended";

type PurchaseEntry = {
  durationDays?: number;
  durationLabel?: string;
  purchasedAt?: any; // Firestore Timestamp
  expiresAt?: any; // Firestore Timestamp
};

type UserDoc = {
  email: string;
  name: string;
  phone: string;
  purchasedCourseIds: string[];
  purchases?: Record<string, PurchaseEntry>;
  role?: UserRole;
  createdAt?: string;

  avatarUrl?: string;
  accountStatus?: AccountStatus;
  authMethod?: "email" | "google" | "unknown";
};

type AuthContextType = {
  user: User | null;
  userDoc: UserDoc | null;
  purchasedCourseIds: string[];
  role: UserRole;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function detectAuthMethod(u: User): "email" | "google" | "unknown" {
  const providers = (u.providerData || []).map((p) => p.providerId);
  if (providers.includes("google.com")) return "google";
  if (providers.includes("password")) return "email";
  return "unknown";
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserDoc = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    const method = detectAuthMethod(u);

    if (!snap.exists()) {
      const newDoc: UserDoc = {
        email: u.email || "",
        name: "",
        phone: "",
        purchasedCourseIds: [],
        purchases: {},

        role: "user",
        createdAt: new Date().toISOString(),

        avatarUrl: "",
        accountStatus: "active",
        authMethod: method,
      };
      await setDoc(ref, newDoc, { merge: true });
      return;
    }

    const data = snap.data() || {};

    if (!("purchasedCourseIds" in data)) {
      await setDoc(ref, { purchasedCourseIds: [] }, { merge: true });
    }
    if (!("purchases" in data)) {
      await setDoc(ref, { purchases: {} }, { merge: true });
    }
    if (!("role" in data)) {
      await setDoc(ref, { role: "user" }, { merge: true });
    }
    if (!("createdAt" in data)) {
      await setDoc(ref, { createdAt: new Date().toISOString() }, { merge: true });
    }
    if (!("avatarUrl" in data)) {
      await setDoc(ref, { avatarUrl: "" }, { merge: true });
    }
    if (!("accountStatus" in data)) {
      await setDoc(ref, { accountStatus: "active" }, { merge: true });
    }
    if (!("authMethod" in data)) {
      await setDoc(ref, { authMethod: method }, { merge: true });
    }
  };

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const init = async () => {
      try {
        // ✅ MOBILE-д хамгийн чухал: auth хадгалалтыг LOCAL болгоно
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        // зарим browser дээр persistence fail байж болно → тэгсэн ч үргэлжлүүлнэ
        console.warn("setPersistence failed:", e);
      }

      const unsubAuth = onAuthStateChanged(auth, async (u) => {
        if (unsubUserDoc) {
          unsubUserDoc();
          unsubUserDoc = null;
        }

        setUser(u ?? null);

        if (!u) {
          setUserDoc(null);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);

          await ensureUserDoc(u);

          const ref = doc(db, "users", u.uid);

          unsubUserDoc = onSnapshot(
            ref,
            (snap) => {
              if (!snap.exists()) {
                setUserDoc(null);
                setLoading(false);
                return;
              }

              const d = snap.data() as any;

              setUserDoc({
                email: d.email ?? (u.email || ""),
                name: d.name ?? "",
                phone: d.phone ?? "",
                purchasedCourseIds: Array.isArray(d.purchasedCourseIds)
                  ? d.purchasedCourseIds
                  : [],
                purchases: d.purchases ?? {},
                role: d.role === "admin" ? "admin" : "user",
                createdAt: d.createdAt,

                avatarUrl: d.avatarUrl ?? "",
                accountStatus: d.accountStatus === "suspended" ? "suspended" : "active",
                authMethod:
                  d.authMethod === "google"
                    ? "google"
                    : d.authMethod === "email"
                    ? "email"
                    : "unknown",
              });

              setLoading(false);
            },
            (err) => {
              console.error("onSnapshot userDoc error:", err);
              setUserDoc(null);
              setLoading(false);
            }
          );
        } catch (err) {
          console.error("AuthProvider ensureUserDoc error:", err);
          setUserDoc(null);
          setLoading(false);
        }
      });

      return () => {
        unsubAuth();
        if (unsubUserDoc) unsubUserDoc();
      };
    };

    let cleanup: null | (() => void) = null;
    init().then((fn) => {
      cleanup = fn ?? null;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      // ✅ UI дээр шууд гараад харагдуулахын тулд state цэвэрлэнэ
      setUser(null);
      setUserDoc(null);
      setLoading(false);
    }
  };

  const purchasedCourseIds = userDoc?.purchasedCourseIds ?? [];
  const role: UserRole = userDoc?.role === "admin" ? "admin" : "user";

  return (
    <AuthContext.Provider value={{ user, userDoc, purchasedCourseIds, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}