"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useEffect, useMemo, useRef, useState } from "react";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

/* =========================
   Theme helpers (class-based dark mode)
========================= */
type ThemeMode = "dark" | "light";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", mode);
}

function getSavedTheme(): ThemeMode {
  const v = (typeof window !== "undefined" && localStorage.getItem("theme")) || "";
  return v === "light" ? "light" : "dark";
}

type Lang = "MN" | "EN";
function getSavedLang(): Lang {
  const v = (typeof window !== "undefined" && localStorage.getItem("lang")) || "";
  return v === "EN" ? "EN" : "MN";
}
function saveLang(l: Lang) {
  localStorage.setItem("lang", l);
}

/* =========================
   Modern icons (inline SVG)
========================= */
function IconUser({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5c0-2.485-3.582-4.5-8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 20V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 16v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconSettings({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a7.94 7.94 0 0 0 .1-1 7.94 7.94 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-1.7-1L15 3h-6l-.3 3a8.4 8.4 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 12a7.94 7.94 0 0 0-.1 1 7.94 7.94 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a8.4 8.4 0 0 0 1.7 1l.3 3h6l.3-3a8.4 8.4 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconLogout({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 8l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M2 12h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 2c3 3 3 17 0 20C9 19 9 5 12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSun({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0-6-6 6 6 0 0 0 6 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 2v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19.5V22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 12h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.5 12H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 4.2 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 18l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 19.8 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconMoon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M21 13.5A8.5 8.5 0 0 1 10.5 3 7.5 7.5 0 1 0 21 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================
   Admin Dropdown (solid black)
========================= */
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
          className="absolute left-0 mt-2 w-44 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl z-[999]"
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

          <Link
            href="/admin/banner"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            role="menuitem"
          >
            BANNER
          </Link>

              <div className="h-px bg-white/12 mx-3 my-1" />

          <Link
            href="/admin/users"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            role="menuitem"
          >
            USERS
          </Link>
        </div>
      )}
    </div>
  );
}

/* =========================
   Profile Dropdown (bigger + clean + solid black + stroke)
========================= */
function ProfileDropdown({
  email,
  displayName,
  avatarUrl,
  onLogout,
}: {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  onLogout: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [lang, setLang] = useState<Lang>("MN");

  const initials = useMemo(() => {
    const base = (displayName?.trim() || email || "U").trim();
    const parts = base.split(" ").filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }, [displayName, email]);

  useEffect(() => {
    const t = getSavedTheme();
    const l = getSavedLang();
    setTheme(t);
    setLang(l);
    applyTheme(t);
  }, []);

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

  const handleLogout = async () => {
    setOpen(false);
    await onLogout();
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const toggleLang = () => {
    const next: Lang = lang === "MN" ? "EN" : "MN";
    setLang(next);
    saveLang(next);
  };

  // ✅ bigger, cleaner
  const iconBox =
    "grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/12 group-hover:bg-white/10 group-hover:ring-white/25 transition";
  const itemRow =
    "group flex items-center gap-3 px-4 py-3 text-[15px] font-semibold text-white/90 hover:bg-white/10 transition";

  return (
    <div ref={ref} className="relative">
      {/* button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 hover:bg-white/15",
          "ring-1 ring-white/15"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/15 bg-white/10">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-xs font-extrabold text-white/95">
              {initials}
            </span>
          )}
        </span>

        <span className="hidden sm:block max-w-[150px] truncate text-white/90 font-semibold">
          {displayName?.trim() ? displayName : "PROFILE"}
        </span>
      </button>

      {open && (
        <div
          className={cn(
            // ✅ bigger width + solid black
            "absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl bg-black",
            // ✅ clean stroke + depth
            "border border-white/18 ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.75)] z-[999]",
            // ✅ subtle pro highlight
            "before:absolute before:inset-0 before:pointer-events-none before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-60"
          )}
          role="menu"
        >
          {/* Top info */}
          <div className="relative px-5 pt-5 pb-4 border-b border-white/12">
            <div className="flex items-center gap-4">
              <span className="relative h-12 w-12 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-sm font-extrabold text-white">
                    {initials}
                  </span>
                )}
              </span>

              <div className="min-w-0">
                <div className="text-[16px] font-extrabold text-white truncate">
                  {displayName?.trim() ? displayName : "Хэрэглэгч"}
                </div>
                <div className="text-sm text-white/65 truncate">{email}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <Link href="/profile" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconUser className="h-5 w-5 text-white/90" />
            </span>
            Ерөнхий мэдээлэл
          </Link>

          <Link href="/progress" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconChart className="h-5 w-5 text-white/90" />
            </span>
            Ахиц / Progress
          </Link>

          <Link href="/settings" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconSettings className="h-5 w-5 text-white/90" />
            </span>
            Тохиргоо
          </Link>

          <div className="h-px bg-white/12 mx-5 my-1" />

          <button
            type="button"
            onClick={handleLogout}
            className={cn(itemRow, "text-red-200 hover:text-red-100")}
            role="menuitem"
          >
            <span className={iconBox}>
              <IconLogout className="h-5 w-5 text-red-200" />
            </span>
            Гарах
          </button>

          {/* ✅ Language + Theme : FULL width, 2 rows (not cramped) */}
          <div className="relative border-t border-white/12 px-5 py-4">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={toggleLang}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                  "bg-white/6 hover:bg-white/10 transition",
                  "ring-1 ring-white/12 hover:ring-white/25"
                )}
                aria-label="Language"
              >
                <span className="flex items-center gap-3 text-[14px] font-semibold text-white/90">
                  <IconGlobe className="h-5 w-5 text-white/90" />
                  Language
                </span>
                <span className="text-xs font-extrabold text-white bg-white/12 px-3 py-1.5 rounded-xl">
                  {lang}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                  "bg-white/6 hover:bg-white/10 transition",
                  "ring-1 ring-white/12 hover:ring-white/25"
                )}
                aria-label="Theme"
              >
                <span className="flex items-center gap-3 text-[14px] font-semibold text-white/90">
                  {theme === "dark" ? (
                    <IconMoon className="h-5 w-5 text-white/90" />
                  ) : (
                    <IconSun className="h-5 w-5 text-white/90" />
                  )}
                  Theme
                </span>
                <span className="text-xs font-extrabold text-white bg-white/12 px-3 py-1.5 rounded-xl">
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              * Theme/Language тохиргоо localStorage-д хадгалагдана.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userDoc, loading, logout, role } = useAuth();

  const [qs, setQs] = useState("");
  useEffect(() => {
    setQs(window.location.search || "");
  }, [pathname]);

  const currentUrl = useMemo(() => `${pathname || "/"}${qs}`, [pathname, qs]);

  const goLogin = (callbackUrl: string) => {
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
       <Link
  href="/"
  className="
    group flex items-center gap-3
    select-none
  "
>
  {/* EBACREATOR text */}
  <span
    className="
      text-sm font-semibold tracking-wide
      text-orange-400
      transition-colors duration-200
      group-hover:text-orange-300
    "
  >
    EBACREATOR
  </span>

  {/* thin line */}
  <span
    className="
      h-px w-10
      bg-white/30
      transition-colors duration-200
      group-hover:bg-orange-400/60
    "
  />
</Link>

        

        <nav className="flex items-center gap-2 text-sm">
          <Link className="rounded-full px-3 py-2 hover:bg-white/10" href="/contents">
            СУРГАЛТУУД
          </Link>

          {!loading && !user ? (
            <button onClick={() => goLogin("/my-content")} className="rounded-full px-3 py-2 hover:bg-white/10">
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
            <button onClick={() => goLogin(currentUrl)} className="rounded-full bg-white/10 px-3 py-2 hover:bg-white/15">
              НЭВТРЭХ
            </button>
          )}

          {!loading && user && (
            <div className="flex items-center gap-2">
              <ProfileDropdown
                email={user.email || ""}
                displayName={userDoc?.name || ""}
                avatarUrl={userDoc?.avatarUrl || ""}
                onLogout={onLogout}
              />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
