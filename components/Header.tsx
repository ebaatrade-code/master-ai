"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useEffect, useMemo, useRef, useState } from "react";

function AdminDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-3 py-2 hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ADMIN
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/80 backdrop-blur shadow-xl"
          role="menu"
        >
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            role="menuitem"
          >
            ADMIN
          </Link>

          <Link
            href="/analist"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            role="menuitem"
          >
            ANALIST
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, role } = useAuth();

  // ✅ useSearchParams хэрэглэхгүйгээр бүтэн URL авах
  const [qs, setQs] = useState("");
  useEffect(() => {
    // client дээр л ажиллана
    setQs(window.location.search || "");
  }, [pathname]);

  const currentUrl = useMemo(() => {
    return `${pathname || "/"}${qs}`;
  }, [pathname, qs]);

  const goLogin = (callbackUrl: string) => {
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-bold">
            M
          </div>
          <div className="font-semibold">MASTER AI</div>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link className="rounded-full px-3 py-2 hover:bg-white/10" href="/contents">
            СУРГАЛТУУД
          </Link>

          {!loading && !user ? (
            <button
              onClick={() => goLogin("/my-content")}
              className="rounded-full px-3 py-2 hover:bg-white/10"
            >
              МИНИЙ СУРГАЛТУУД
            </button>
          ) : (
            <Link className="rounded-full px-3 py-2 hover:bg-white/10" href="/my-content">
              МИНИЙ СУРГАЛТУУД
            </Link>
          )}

          {!loading && user && isAdmin && <AdminDropdown />}

          {loading && <div className="ml-2 h-9 w-24 rounded-full bg-white/10 animate-pulse" />}

          {!loading && !user && (
            <button
              onClick={() => goLogin(currentUrl)}
              className="rounded-full bg-white/10 px-3 py-2 hover:bg-white/15"
            >
              НЭВТРЭХ
            </button>
          )}

          {!loading && user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:block rounded-full bg-white/10 px-3 py-2 text-white/80">
                {user.email}
              </div>
              <button
                onClick={onLogout}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-white/15"
              >
                ГАРАХ
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
