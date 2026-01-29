import { Suspense } from "react";
import HomeClient from "./HomeClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white/60">Ачааллаж байна...</div>}>
      <HomeClient />
    </Suspense>
  );
}
