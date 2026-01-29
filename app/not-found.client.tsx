"use client";

import { useSearchParams } from "next/navigation";

export default function NotFoundClient() {
  const sp = useSearchParams();
  const from = sp.get("from");

  return (
    <div className="min-h-screen grid place-items-center bg-black text-white">
      <div className="text-center">
        <div className="text-3xl font-bold mb-2">404</div>
        <div className="text-white/70">Хуудас олдсонгүй</div>
        {from && <div className="mt-3 text-white/50 text-sm">from: {from}</div>}
      </div>
    </div>
  );
}
