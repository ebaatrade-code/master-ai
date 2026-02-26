"use client";

import { usePathname } from "next/navigation";
import Shell from "@/components/Shell";

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  // ✅ AUTH pages: frame-гүй (цагаан panel гарахгүй), Shell өөрөө auth UI-г харуулна
  if (isAuthPage) {
    return <Shell>{children}</Shell>;
  }

  // ✅ Бусад pages: одоогийн frame-ээ 1:1 хэвээр хадгална
  return (
    <div className="relative mx-auto w-full max-w-[1400px] px-0 py-0 md:px-6 md:py-10 z-10">
      <div
        className="
          relative overflow-hidden
          bg-white
          ring-1 ring-black/10
          shadow-[0_30px_120px_rgba(0,0,0,0.10)]
          rounded-none
          md:rounded-[28px]
        "
      >
        {/* ✅ subtle top highlight (light) */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.04),transparent_38%)]" />

        <Shell>{children}</Shell>
      </div>
    </div>
  );
}