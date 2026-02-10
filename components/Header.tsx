// components/Header.tsx
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
   Icons (inline SVG)
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

function IconSettings({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
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
      <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" stroke="currentColor" strokeWidth="1.8" />
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
      <path d="M12 18a6 6 0 1 0-6-6 6 6 0 0 0 6 6Z" stroke="currentColor" strokeWidth="1.8" />
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

function IconReceipt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconHamburger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* =========================
   Profile Dropdown (desktop)
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

  const iconBox =
    "grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/12 group-hover:bg-white/10 group-hover:ring-white/25 transition";
  const itemRow =
    "group flex items-center gap-3 px-4 py-3 text-[15px] font-semibold text-white/90 hover:bg-white/10 transition";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-2 ring-1",
          "bg-black/5 text-black hover:bg-black/10 ring-black/10",
          "md:bg-white/10 md:text-white md:hover:bg-white/15 md:ring-white/15"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={cn(
            "relative h-8 w-8 overflow-hidden rounded-full ring-1",
            "ring-black/10 bg-black/5",
            "md:ring-white/15 md:bg-white/10"
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span
              className={cn(
                "grid h-full w-full place-items-center text-xs font-extrabold",
                "text-black/90 md:text-white/95"
              )}
            >
              {initials}
            </span>
          )}
        </span>

        <span className="hidden sm:block max-w-[150px] truncate font-semibold text-black/90 md:text-white/90">
          {displayName?.trim() ? displayName : "PROFILE"}
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl bg-black",
            "border border-white/18 ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.75)] z-[999]",
            "before:absolute before:inset-0 before:pointer-events-none before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-60"
          )}
          role="menu"
        >
          <div className="relative px-5 pt-5 pb-4 border-b border-white/12">
            <div className="flex items-center gap-4">
              <span className="relative h-12 w-12 overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-sm font-extrabold text-white">{initials}</span>
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

          <Link href="/profile" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconUser className="h-5 w-5 text-white/90" />
            </span>
            Профайл
          </Link>

          <Link href="/profile/purchases" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconReceipt className="h-5 w-5 text-white/90" />
            </span>
            Худалдан авалтын түүх
          </Link>

          <Link href="/settings" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconSettings className="h-5 w-5 text-white/90" />
            </span>
            Тохиргоо
          </Link>

          <div className="h-px bg-white/12 mx-5 my-1" />

          <button type="button" onClick={handleLogout} className={cn(itemRow, "text-red-200 hover:text-red-100")} role="menuitem">
            <span className={iconBox}>
              <IconLogout className="h-5 w-5 text-red-200" />
            </span>
            Гарах
          </button>

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
              >
                <span className="flex items-center gap-3 text-[14px] font-semibold text-white/90">
                  <IconGlobe className="h-5 w-5 text-white/90" />
                  Language
                </span>
                <span className="text-xs font-extrabold text-white bg-white/12 px-3 py-1.5 rounded-xl">{lang}</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                  "bg-white/6 hover:bg-white/10 transition",
                  "ring-1 ring-white/12 hover:ring-white/25"
                )}
              >
                <span className="flex items-center gap-3 text-[14px] font-semibold text-white/90">
                  {theme === "dark" ? <IconMoon className="h-5 w-5 text-white/90" /> : <IconSun className="h-5 w-5 text-white/90" />}
                  Theme
                </span>
                <span className="text-xs font-extrabold text-white bg-white/12 px-3 py-1.5 rounded-xl">
                  {theme === "dark" ? "Dark" : "Light"}
                </span>
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/45">* Theme/Language тохиргоо localStorage-д хадгалагдана.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Mobile Drawer Menu
========================= */
function MobileMenu({
  open,
  onClose,
  isAuthed,
  onLogout,
  goLogin,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAuthed: boolean;
  onLogout: () => Promise<void> | void;
  goLogin: () => void;
  isAdmin: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!open) return null;

  const item =
    "w-full flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-[15px] font-medium text-black hover:bg-black/[0.04] active:scale-[0.99] transition";
  const right = "text-black/35";

  return (
    <div className="fixed inset-0 z-[9999] md:hidden">
      {/* overlay */}
      <button aria-label="Close menu overlay" className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* panel */}
      <div className="absolute left-0 top-0 h-full w-[86vw] max-w-[360px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 h-14 border-b border-black/10">
          <div className="text-[13px] tracking-widest text-black/60">MENU</div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full border border-black/10 bg-white active:scale-[0.98]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <button onClick={() => go("/contents")} className={item}>
            <span>Сургалтууд</span>
            <span className={right}>›</span>
          </button>

          <button onClick={() => go("/my-content")} className={item}>
            <span>Миний сургалтууд</span>
            <span className={right}>›</span>
          </button>

          {/* ✅ admin menu (mobile) */}
          {isAuthed && isAdmin && (
            <>
              <div className="pt-2 border-t border-black/10" />
              <div className="text-[12px] tracking-widest text-black/40 px-1">ADMIN</div>

              <button onClick={() => go("/admin")} className={item}>
                <span>Admin Home</span>
                <span className={right}>›</span>
              </button>
              <button onClick={() => go("/admin/users")} className={item}>
                <span>Users</span>
                <span className={right}>›</span>
              </button>
              <button onClick={() => go("/admin/banner")} className={item}>
                <span>Banner</span>
                <span className={right}>›</span>
              </button>
              <button onClick={() => go("/analist")} className={item}>
                <span>Analist</span>
                <span className={right}>›</span>
              </button>
            </>
          )}

          {/* ✅ authenticated items */}
          {isAuthed && (
            <button onClick={() => go("/profile/purchases")} className={item}>
              <span>Худалдан авалтын түүх</span>
              <span className={right}>›</span>
            </button>
          )}

          {isAuthed && (
            <button onClick={() => go("/profile")} className={item}>
              <span>Профайл</span>
              <span className={right}>›</span>
            </button>
          )}

          {isAuthed && (
            <button onClick={() => go("/settings")} className={item}>
              <span>Тохиргоо</span>
              <span className={right}>›</span>
            </button>
          )}

          <div className="pt-2 border-t border-black/10" />

          {!isAuthed ? (
            <button
              onClick={() => {
                onClose();
                goLogin();
              }}
              className="w-full rounded-2xl bg-black text-white py-3 text-[15px] font-semibold active:scale-[0.99]"
            >
              Нэвтрэх
            </button>
          ) : (
            <button
              onClick={async () => {
                onClose();
                await onLogout();
              }}
              className="w-full rounded-2xl border border-black/10 bg-white py-3 text-[15px] font-semibold text-red-600 active:scale-[0.99]"
            >
              Гарах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Header (Desktop + Mobile)
========================= */
export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userDoc, loading, logout, role } = useAuth();

  const [qs, setQs] = useState("");
  useEffect(() => {
    setQs(window.location.search || "");
  }, [pathname]);

  const currentUrl = useMemo(() => `${pathname || "/"}${qs}`, [pathname, qs]);

  const goLogin = () => {
    router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
  };

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = role === "admin";

  // ✅ mobile drawer state
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ Admin dropdown (desktop)
  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!adminRef.current) return;
      if (!adminRef.current.contains(e.target as Node)) setAdminOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    setAdminOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 backdrop-blur",
        "border-b border-black/10 bg-white text-black",
        "md:border-white/10 md:bg-black/70 md:text-white"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* LEFT: mobile hamburger + brand */}
        <div className="flex items-center gap-2">
          {/* ✅ Mobile hamburger */}
          <button
            className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-black/10 bg-white active:scale-[0.98]"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <IconHamburger className="h-5 w-5 text-black" />
          </button>

          <Link href="/" className="group flex items-center gap-3 select-none">
            <span
              className="
                text-sm font-semibold tracking-wide
                text-orange-500
                transition-colors duration-200
                group-hover:text-orange-400
                md:text-orange-400 md:group-hover:text-orange-300
              "
            >
              EBACREATOR
            </span>

            <span
              className="
                hidden sm:block
                h-px w-10
                bg-black/25
                transition-colors duration-200
                group-hover:bg-orange-500/60
                md:bg-white/30 md:group-hover:bg-orange-400/60
              "
            />
          </Link>
        </div>

        {/* RIGHT: desktop nav */}
        <nav className="hidden md:flex items-center gap-2 text-sm">
          <Link className="rounded-full px-3 py-2 hover:bg-black/5 md:hover:bg-white/10" href="/contents">
            СУРГАЛТУУД
          </Link>

          {!loading && !user ? (
            <button
              onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent("/my-content")}`)}
              className="rounded-full px-3 py-2 hover:bg-black/5 md:hover:bg-white/10"
            >
              МИНИЙ СУРГАЛТУУД
            </button>
          ) : (
            <Link className="rounded-full px-3 py-2 hover:bg-black/5 md:hover:bg-white/10" href="/my-content">
              МИНИЙ СУРГАЛТУУД
            </Link>
          )}

          {/* ✅ ADMIN dropdown */}
          {!loading && user && isAdmin && (
            <div ref={adminRef} className="relative">
              <button
                type="button"
                onClick={() => setAdminOpen((v) => !v)}
                onMouseEnter={() => setAdminOpen(true)}
                className={cn(
                  "rounded-full px-3 py-2 font-semibold",
                  "hover:bg-black/5 md:hover:bg-white/10",
                  adminOpen && "bg-black/5 md:bg-white/10"
                )}
                aria-haspopup="menu"
                aria-expanded={adminOpen}
              >
            АДМИН
              </button>

              {adminOpen && (
                <div
                  onMouseLeave={() => setAdminOpen(false)}
                  className={cn(
                    "absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl",
                    "border border-white/15 bg-black/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
                    "ring-1 ring-white/10 z-[999]"
                  )}
                  role="menu"
                >
                  <Link
                    href="/admin"
                    onClick={() => setAdminOpen(false)}
                    className="block px-4 py-3 text-sm font-semibold hover:bg-white/10"
                    role="menuitem"
                  >
                    ADMIN Home
                  </Link>
                  <div className="h-px bg-white/10" />
                  <Link
                    href="/admin/users"
                    onClick={() => setAdminOpen(false)}
                    className="block px-4 py-3 text-sm font-semibold hover:bg-white/10"
                    role="menuitem"
                  >
                    USERS
                  </Link>
                  <Link
                    href="/admin/BANNER"
                    onClick={() => setAdminOpen(false)}
                    className="block px-4 py-3 text-sm font-semibold hover:bg-white/10"
                    role="menuitem"
                  >
                    BANNER
                  </Link>
                  <Link
                    href="/analist"
                    onClick={() => setAdminOpen(false)}
                    className="block px-4 py-3 text-sm font-semibold hover:bg-white/10"
                    role="menuitem"
                  >
                ANALIST
                  </Link>
                </div>
              )}
            </div>
          )}

          {loading && <div className="ml-2 h-9 w-24 rounded-full bg-black/5 animate-pulse md:bg-white/10" />}

          {!loading && !user && (
            <button
              onClick={goLogin}
              className="rounded-full bg-black/5 px-3 py-2 hover:bg-black/10 md:bg-white/10 md:hover:bg-white/15"
            >
              НЭВТРЭХ
            </button>
          )}

          {!loading && user && (
            <div className="flex items-center gap-2">
              <ProfileDropdown
                email={user.email || ""}
                displayName={userDoc?.name || ""}
                avatarUrl={(userDoc as any)?.avatarUrl || ""}
                onLogout={onLogout}
              />
            </div>
          )}
        </nav>

        {/* RIGHT: mobile profile icon (optional) */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => (user ? router.push("/profile") : goLogin())}
            className="h-10 w-10 grid place-items-center rounded-full border border-black/10 bg-white active:scale-[0.98]"
            aria-label="Profile"
          >
            <IconUser className="h-5 w-5 text-black" />
          </button>
        </div>
      </div>

      {/* ✅ Mobile drawer */}
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isAuthed={!!user}
        onLogout={onLogout}
        goLogin={goLogin}
        isAdmin={isAdmin}
      />
    </header>
  );
}