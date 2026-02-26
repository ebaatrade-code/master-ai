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
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EBACREATOR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`bg-white ${mulish.variable}`}>
      <body className="min-h-screen bg-white text-black">
        <AuthProvider>
          <Suspense fallback={null}>
            {/* ✅ Layout дээр frame/wrapper байхгүй */}
            <Shell>{children}</Shell>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}