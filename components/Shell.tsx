"use client";

import Header from "@/components/Header";
import MobileHeader from "@/components/MobileHeader";
import Footer from "@/components/Footer";
import TopBanner from "@/components/TopBanner";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, loading, logout } = useAuth();

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  // ✅ AUTH pages: ямар ч frame/panel байхгүй — 100% full white
  if (isAuthPage) {
    return <div className="min-h-screen w-full bg-white text-black">{children}</div>;
  }

  const isAuthed = !!user;
  const loadingAuth = !!loading;

  const onLogin = () => router.push("/login");

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    // ✅ FRAME-ийг зөвхөн auth биш хуудсууд дээр л хадгална (хуучин дизайн 1:1)
    <div className="relative min-h-screen bg-white text-black">
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

          {/* ✅ MAIN CONTENT */}
          <div className="relative z-10 min-h-screen flex flex-col bg-white text-black">
            <TopBanner />

            <Suspense fallback={<div className="h-[56px]" />}>
              <MobileHeader
                isAuthed={isAuthed}
                loadingAuth={loadingAuth}
                onLogin={onLogin}
                onLogout={onLogout}
              />

              <div className="hidden md:block">
                <Header />
              </div>
            </Suspense>

            <main className="flex-1 bg-white text-black">{children}</main>

            {/* ✅ FOOTER — Саарал хэвээр */}
            <div className="bg-gray-200 border-t border-gray-200">
              <Footer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}