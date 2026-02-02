// components/Shell.tsx
"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TopBanner from "@/components/TopBanner";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  if (isAuthPage) {
    return <div className="min-h-screen bg-[#0b0b0f] text-white">{children}</div>;
  }

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden flex flex-col">
      {/* ✅ HERO BG — илүү тод болгож, хар overlay-г багасгав */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.55]"
          style={{ backgroundImage: "url(/hero/hero-bg.png)" }}
        />
        {/* overlay-г багасгав (өмнө нь 55% байсан) */}
        <div className="absolute inset-0 bg-black/25" />

        {/* glow-ууд чинь хэвээр */}
        <div className="absolute -top-48 right-[-240px] h-[560px] w-[560px] rounded-full bg-orange-500/25 blur-[140px]" />
        <div className="absolute -bottom-56 left-1/2 h-[700px] w-[980px] -translate-x-1/2 rounded-full bg-orange-500/25 blur-[170px]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <TopBanner />

        <Suspense fallback={<div className="h-[60px]" />}>
          <Header />
        </Suspense>

        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
