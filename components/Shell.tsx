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

  // ✅ IMPORTANT: Hook-оо үргэлж дээр нь дуудна (conditional return-оос өмнө)
  const { user, loading, logout } = useAuth();

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  // ✅ Auth page дээр UI нь зөвхөн өөр өнгөтэй (desktop-ийг огт эвдэхгүй)
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-white text-black md:bg-[#0b0b0f] md:text-white">
        {children}
      </div>
    );
  }

  // ✅ REAL AUTH state
  const isAuthed = !!user;
  const loadingAuth = !!loading;

  // ✅ Mobile дээр "Нэвтрэх" рүү явуулах
  const onLogin = () => router.push("/login");

  // ✅ Logout үнэхээр Firebase signOut хийх
  const onLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col bg-white text-black md:bg-transparent md:text-white">
      {/* ✅ HERO BG — DESKTOP ONLY */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden hidden md:block">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.55]"
          style={{ backgroundImage: "url(/hero/hero-bg.png)" }}
        />
        <div className="absolute inset-0 bg-black/25" />

        <div className="absolute -top-48 right-[-240px] h-[560px] w-[560px] rounded-full bg-orange-500/25 blur-[140px]" />
        <div className="absolute -bottom-56 left-1/2 h-[700px] w-[980px] -translate-x-1/2 rounded-full bg-orange-500/25 blur-[170px]" />
      </div>

      {/* ✅ CONTENT */}
      <div className="relative z-10 min-h-screen flex flex-col bg-white text-black md:bg-transparent md:text-white">
        <TopBanner />

        <Suspense fallback={<div className="h-[56px]" />}>
          {/* 📱 Mobile header */}
          <MobileHeader
            isAuthed={isAuthed}
            loadingAuth={loadingAuth}
            onLogin={onLogin}
            onLogout={onLogout}
          />

          {/* 💻 Desktop header */}
          <div className="hidden md:block">
            <Header />
          </div>
        </Suspense>

        <main className="flex-1 bg-white text-black md:bg-transparent md:text-white">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}