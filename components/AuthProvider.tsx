"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = "admin" | "user";

type AccountStatus = "active" | "suspended";

type UserDoc = {
  email: string;
  name: string;
  phone: string;
  purchasedCourseIds: string[];

  role?: UserRole; // admin/user
  createdAt?: string;

  // ✅ NEW (Profile UX-д хэрэгтэй)
  avatarUrl?: string; // Firebase Storage url
  accountStatus?: AccountStatus; // active/suspended (read-only)
  authMethod?: "email" | "google" | "unknown"; // read-only
};

type AuthContextType = {
  user: User | null;
  userDoc: UserDoc | null;
  purchasedCourseIds: string[];
  role: UserRole; // always "admin" | "user"
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function detectAuthMethod(u: User): "email" | "google" | "unknown" {
  // providerData дээрээс уншина
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

    // ✅ new user doc
    if (!snap.exists()) {
      const newDoc: UserDoc = {
        email: u.email || "",
        name: "",
        phone: "",
        purchasedCourseIds: [],
        role: "user",
        createdAt: new Date().toISOString(),

        // ✅ defaults
        avatarUrl: "",
        accountStatus: "active",
        authMethod: method,
      };
      await setDoc(ref, newDoc, { merge: true });
      return;
    }

    // ✅ existing user: missing fields?
    const data = snap.data() || {};

    if (!("purchasedCourseIds" in data)) {
      await setDoc(ref, { purchasedCourseIds: [] }, { merge: true });
    }

    if (!("role" in data)) {
      await setDoc(ref, { role: "user" }, { merge: true });
    }

    if (!("createdAt" in data)) {
      await setDoc(ref, { createdAt: new Date().toISOString() }, { merge: true });
    }

    // ✅ NEW fields
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

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // өмнөх listener цэвэрлэх
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
              purchasedCourseIds: Array.isArray(d.purchasedCourseIds) ? d.purchasedCourseIds : [],
              role: d.role === "admin" ? "admin" : "user",
              createdAt: d.createdAt,

              avatarUrl: d.avatarUrl ?? "",
              accountStatus: d.accountStatus === "suspended" ? "suspended" : "active",
              authMethod:
                d.authMethod === "google" ? "google" : d.authMethod === "email" ? "email" : "unknown",
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
  }, []);

  const logout = async () => {
    await signOut(auth);
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
