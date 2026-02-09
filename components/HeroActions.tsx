"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function HeroActions() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const [qs, setQs] = useState("");
  useEffect(() => {
    setQs(window.location.search || "");
  }, [pathname]);

  const currentUrl = useMemo(() => {
    return `${pathname || "/"}${qs}`;
  }, [pathname, qs]);

  const goLogin = () => {
    router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
  };

  if (loading) {
    return (
      <div className="mt-6 flex gap-3">
        <div className="h-10 w-32 rounded-full bg-white/10 animate-pulse" />
        <div className="h-10 w-28 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/contents"
          className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90"
        >
          Контентууд үзэх
        </Link>

        <button
          onClick={goLogin}
          className="rounded-full bg-white/10 text-white px-5 py-2 text-sm font-semibold hover:bg-white/15"
        >
          Нэвтрэх
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href="/my-content"
        className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90"
      >
        Миний сургалтууд
      </Link>

      <Link
        href="/contents"
        className="rounded-full bg-white/10 text-white px-5 py-2 text-sm font-semibold hover:bg-white/15"
      >
        Контентууд
      </Link>

      {/* ✅ NEW: Худалдан авалтын түүх */}
      <Link
        href="/profile/purchases"
        className="rounded-full bg-white/10 text-white px-5 py-2 text-sm font-semibold hover:bg-white/15"
      >
        Худалдан авалтын түүх
      </Link>
    </div>
  );
}