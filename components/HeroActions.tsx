"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function HeroActions() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const currentUrl = useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : (pathname || "/");
  }, [pathname, searchParams]);

  const goLogin = () => {
    router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
  };

  // loading үед UI савлахгүй жижиг placeholder
  if (loading) {
    return (
      <div className="mt-6 flex gap-3">
        <div className="h-10 w-32 rounded-full bg-white/10 animate-pulse" />
        <div className="h-10 w-28 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  // ✅ login хийгээгүй үед: Контент + Нэвтрэх
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

  // ✅ login хийсэн үед: Нэвтрэх алга болно (эсвэл Миний контент руу)
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
    </div>
  );
}
