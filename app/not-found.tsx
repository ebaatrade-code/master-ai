import { Suspense } from "react";
import NotFoundClient from "./not-found.client";

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundClient />
    </Suspense>
  );
}
