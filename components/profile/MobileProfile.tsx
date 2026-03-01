"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type DbUser = {
  name?: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  createdAt?: any; // Firestore Timestamp байж болно
  role?: string;

  purchasedCourseIds?: string[];
  bio?: string;
  username?: string;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatJoined(v: any) {
  try {
    // Firestore Timestamp support
    const d =
      v?.toDate?.() instanceof Date
        ? v.toDate()
        : typeof v === "string"
          ? new Date(v)
          : v instanceof Date
            ? v
            : null;

    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("mn-MN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function MobileProfile() {
  const router = useRouter();
  const { user } = useAuth();

  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!user?.uid) {
        setDbUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!alive) return;
        setDbUser((snap.exists() ? (snap.data() as any) : null) as DbUser | null);
      } catch {
        if (!alive) return;
        setDbUser(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const displayName = useMemo(() => {
    return (
      dbUser?.name ||
      user?.displayName ||
      (user?.email ? user.email.split("@")[0] : "") ||
      "User"
    );
  }, [dbUser?.name, user?.displayName, user?.email]);

  const handleRaw = useMemo(() => {
    // Skool шиг @handle хэлбэр
    const base =
      dbUser?.username ||
      (user?.email ? user.email.split("@")[0] : "") ||
      (user?.uid ? `user-${user.uid.slice(0, 6)}` : "user");
    return `@${String(base).replace(/\s+/g, "-").toLowerCase()}`;
  }, [dbUser?.username, user?.email, user?.uid]);

  const avatarUrl = useMemo(() => {
    return dbUser?.photoURL || (user as any)?.photoURL || "";
  }, [dbUser?.photoURL, user]);

  const bio = useMemo(() => {
    return dbUser?.bio || "";
  }, [dbUser?.bio]);

  const purchasedCount = useMemo(() => {
    const arr = dbUser?.purchasedCourseIds;
    return Array.isArray(arr) ? arr.length : 0;
  }, [dbUser?.purchasedCourseIds]);

  const joinedLabel = useMemo(() => {
    // Firestore createdAt байхгүй бол Auth metadata-г fallback
    const authCreated = (user as any)?.metadata?.creationTime || "";
    return formatJoined(dbUser?.createdAt || authCreated);
  }, [dbUser?.createdAt, user]);

  return (
    <div className="md:hidden min-h-[calc(100vh-80px)] bg-white text-black">
      {/* ======= Mobile Header (Skool style, хэрэггүй зүйлсгүй) ======= */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/10">
        <div className="mx-auto max-w-md px-4 h-12 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-full border border-black/10 bg-white active:scale-[0.98]"
            aria-label="Back"
            title="Back"
          >
            <span className="text-lg leading-none">←</span>
          </button>

          <div className="text-[15px] font-semibold tracking-tight">Profile</div>

          <button
            onClick={() => router.push("/profile/edit")}
            className="h-9 px-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold active:scale-[0.98]"
          >
            Засах
          </button>
        </div>
      </div>

      {/* ======= Content ======= */}
      <div className="mx-auto max-w-md px-4 pb-10">
        {/* Top card */}
        <div className="pt-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative">
              <div className="h-24 w-24 rounded-full overflow-hidden border border-black/10 bg-black/5">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="avatar"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-black/50">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              {/* жижиг badge (rank гэх мэт) */}
              <div className="absolute -right-1 -bottom-1 h-7 min-w-7 px-2 rounded-full bg-black text-white text-[12px] font-semibold flex items-center justify-center border border-black/10">
                {purchasedCount}
              </div>
            </div>

            <div className="mt-3 text-[22px] font-extrabold tracking-tight">
              {displayName}
            </div>
            <div className="mt-0.5 text-[13px] text-black/55">{handleRaw}</div>

            {bio ? (
              <div className="mt-2 text-[14px] leading-5 text-black/80">{bio}</div>
            ) : (
              <div className="mt-2 text-[14px] leading-5 text-black/50">
                {loading ? "Уншиж байна..." : "Bio хоосон байна."}
              </div>
            )}

            {/* Primary action */}
            <button
              onClick={() => router.push("/profile/edit")}
              className={cn(
                "mt-4 w-full h-11 rounded-xl font-semibold",
                "border border-black/10 bg-white",
                "active:scale-[0.99]"
              )}
            >
              EDIT PROFILE
            </button>
          </div>
        </div>

        {/* Status rows (Skool шиг жижиг info мөрүүд) */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 text-[14px]">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-black/80">Online</span>
          </div>

          <div className="flex items-center gap-3 text-[14px]">
            <span className="text-[16px]">📅</span>
            <span className="text-black/80">Joined {joinedLabel}</span>
          </div>
        </div>

        <div className="my-5 border-t border-black/10" />

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/my-courses")}
            className="h-11 rounded-xl border border-black/10 bg-white font-semibold text-[14px] active:scale-[0.99]"
          >
            Миний курсууд
          </button>
          <button
            onClick={() => router.push("/courses")}
            className="h-11 rounded-xl border border-black/10 bg-white font-semibold text-[14px] active:scale-[0.99]"
          >
            Бүх курс
          </button>
        </div>

        {/* Purchases History (NEW) */}
        <div className="mt-3">
          <button
            onClick={() => router.push("/profile/purchases")}
            className="w-full h-11 rounded-xl border border-black/10 bg-white font-semibold text-[14px] active:scale-[0.99]"
          >
            Худалдан авалтын түүх
          </button>
        </div>

        {/* Safe bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}