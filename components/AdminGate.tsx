"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, role, user } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    if (role !== "admin") {
      router.replace("/");
      return;
    }
  }, [loading, role, user, router, pathname]);

  if (loading) return null;
  if (!user || role !== "admin") return null;

  return <>{children}</>;
}