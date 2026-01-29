// app/login/layout.tsx
import type { ReactNode } from "react";

export default function LoginLayout({ children }: { children: ReactNode }) {
  // Header чинь sticky тул дээд зайг "тооцоолж" өгөөд
  // үлдсэн өндрөөр нь яг голлуулж байна.
  // Header өндөр ойролцоогоор 72px гэж үзлээ (py-3 + контент).
  return (
    <section className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex min-h-[calc(100vh-72px)] items-center justify-center pb-10">
          <div className="translate-y-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
