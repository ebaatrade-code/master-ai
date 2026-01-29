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
      <body className="min-h-screen bg-[#0b0b0f] text-white">
        <AuthProvider>
          <Suspense fallback={null}>
            <Shell>{children}</Shell>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
