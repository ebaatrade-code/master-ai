// app/layout.tsx
import "./globals.css";
import Shell from "@/components/Shell";
import AuthProvider from "@/components/AuthProvider";
import { Suspense } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body className="min-h-screen text-white">
        <AuthProvider>
          <Suspense fallback={null}>
            <div
              className="min-h-screen flex justify-center items-start px-6 py-10 bg-cover bg-center bg-no-repeat"
             style={{ backgroundImage: "url(/hero/hero-bg.png)" }}
            >
              {/* ✅ GLOW WRAPPER */}
              <div className="relative w-full max-w-[1400px]">
                {/* Glow layer */}
                <div className="pointer-events-none absolute -inset-6 rounded-[36px] bg-orange-500/15 blur-[40px]" />
                <div className="pointer-events-none absolute -inset-10 rounded-[42px] bg-yellow-500/20 blur-[80px]" />

                {/* Card */}
                <div
                  className="
                    relative
                    rounded-[28px]
                    overflow-hidden
                    shadow-[0_60px_160px_rgba(0,0,0,0.9)]
                    bg-[#050508]
                  "
                >
                  <Shell>{children}</Shell>

                  {/* Subtle edge highlight */}
                  <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />
                </div>
              </div>
            </div>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
