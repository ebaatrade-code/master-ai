// app/login/layout.tsx
import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  // ✅ Login хэсэг дээр background нийтэд нь цагаан болгоно
  // Header sticky байсан ч хуучин байрлал/голлуулах логик хэвээрээ
  return (
    <section className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex min-h-[calc(100vh-72px)] items-center justify-center pb-10">
          <div className="translate-y-6">{children}</div>
        </div>
      </div>
    </section>
  );
}