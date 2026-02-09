// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import AuthProvider from "@/components/AuthProvider";
import { Suspense } from "react";
import { Mulish } from "next/font/google";

const mulish = Mulish({
  subsets: ["latin", "cyrillic"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-main",
});

export const viewport: Viewport = {
  themeColor: "#0b0d10",
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EBACREATOR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`bg-white md:bg-[#0b0d10] ${mulish.variable}`}>
      <body className="min-h-screen bg-white text-black md:bg-[#0b0d10] md:text-white">
        <AuthProvider>
          <Suspense fallback={null}>
            <div className="relative min-h-screen">
              <div className="pointer-events-none absolute inset-0 hidden md:block premium-bg" />
              <div className="pointer-events-none absolute inset-0 hidden md:block bg-[radial-gradient(1200px_700px_at_70%_0%,rgba(255,138,0,0.20),transparent_55%)]" />
              <div className="pointer-events-none absolute inset-0 hidden md:block bg-[radial-gradient(900px_520px_at_15%_20%,rgba(255,255,255,0.06),transparent_55%)]" />

              <div className="relative mx-auto w-full max-w-[1400px] px-0 py-0 md:px-6 md:py-10 z-10">
                <div className="pointer-events-none absolute -inset-6 hidden md:block rounded-[36px] bg-[rgba(255,138,0,0.08)] blur-[44px]" />
                <div className="pointer-events-none absolute -inset-10 hidden md:block rounded-[42px] bg-[rgba(255,138,0,0.12)] blur-[90px]" />

                <div
                  className="
                    relative overflow-hidden
                    bg-transparent ring-0 shadow-none rounded-none backdrop-blur-0
                    md:bg-transparent
                    md:ring-1 md:ring-white/10
                    md:shadow-[0_60px_160px_rgba(0,0,0,0.90)]
                    md:rounded-[28px]
                    md:backdrop-blur-xl
                  "
                >
                  <div className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(to_bottom,rgba(255,255,255,0.10),transparent_38%)]" />
                  <div className="pointer-events-none absolute inset-0 hidden md:block ring-1 ring-[rgba(255,138,0,0.12)]" />

                  <Shell>{children}</Shell>
                </div>
              </div>
            </div>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}