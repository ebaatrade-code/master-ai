"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = "admin" | "user";

type UserDoc = {
  email: string;
  name: string;
  phone: string;
  purchasedCourseIds: string[];
  role?: UserRole; // ✅ зөвхөн admin/user
  createdAt?: string;
};

type AuthContextType = {
  user: User | null;
  userDoc: UserDoc | null;
  purchasedCourseIds: string[];
  role: UserRole; // ✅ always "admin" | "user"
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserDoc = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    // ✅ new user doc
    if (!snap.exists()) {
      const newDoc: UserDoc = {
        email: u.email || "",
        name: "",
        phone: "",
        purchasedCourseIds: [],
        role: "user", // ✅ default
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, newDoc, { merge: true });
      return;
    }

    // ✅ existing user: missing fields?
    const data = snap.data() || {};

    if (!("purchasedCourseIds" in data)) {
      await setDoc(ref, { purchasedCourseIds: [] }, { merge: true });
    }

    // ✅ role байхгүй бол default user
    if (!("role" in data)) {
      await setDoc(ref, { role: "user" }, { merge: true });
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
              purchasedCourseIds: Array.isArray(d.purchasedCourseIds)
                ? d.purchasedCourseIds
                : [],
              role: d.role === "admin" ? "admin" : "user", // ✅ normalize
              createdAt: d.createdAt,
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
  const role: UserRole = userDoc?.role === "admin" ? "admin" : "user"; // ✅ never null

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
