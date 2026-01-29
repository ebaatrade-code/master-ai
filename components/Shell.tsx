"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ✅ Auth route: энд ямар ч background + header/footer байхгүй
  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  // ✅ Login / Reset password → цэвэр layout
  if (isAuthPage) {
    return <div className="min-h-screen bg-[#0b0b0f] text-white">{children}</div>;
  }

  // ✅ Бусад бүх хуудсууд → hero background + header/footer
  return (
    <div className="relative min-h-screen bg-[#050508] text-white overflow-x-hidden flex flex-col">
      {/* ✅ Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/hero-bg.png)" }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute -top-48 right-[-240px] h-[560px] w-[560px] rounded-full bg-orange-500/25 blur-[140px]" />
        <div className="absolute -bottom-56 left-1/2 h-[700px] w-[980px] -translate-x-1/2 rounded-full bg-orange-500/25 blur-[170px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ✅ ЭНЭ Л ГОЛ ЗАСВАР: Header-ийг Suspense boundary-д орууллаа */}
        <Suspense fallback={<div className="h-[60px]" />}>
          <Header />
        </Suspense>

        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
