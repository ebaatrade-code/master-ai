"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useEffect, useMemo, useRef, useState } from "react";

// ✅ firestore (unread badge + admin requests badge)
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ Drawer login UI
import LoginSheet from "@/components/LoginSheet";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

/* =========================
   Theme helpers (FORCE LIGHT ONLY)
========================= */
type ThemeMode = "dark" | "light";

function applyTheme(_mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("dark");
  try {
    (root.style as any).colorScheme = "light";
  } catch {}
  try {
    localStorage.setItem("theme", "light");
  } catch {}
}

function getSavedTheme(): ThemeMode {
  return "light";
}

type Lang = "MN" | "EN";
function getSavedLang(): Lang {
  const v =
    (typeof window !== "undefined" && localStorage.getItem("lang")) || "";
  return v === "EN" ? "EN" : "MN";
}
function saveLang(l: Lang) {
  localStorage.setItem("lang", l);
}

/* =========================
   ✅ Unread Notifications Count (readAt-based)
========================= */
function useUnreadNotiCount(uid?: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let c = 0;
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data?.readAt && data?.read !== true) c += 1;
        });
        setCount(c);
      },
      () => setCount(0)
    );

    return () => unsub();
  }, [uid]);

  return count;
}

/* =========================
   ✅ Admin "New Requests" Count (supportRequests OPEN)
========================= */
function useOpenRequestsCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, "supportRequests"),
      where("status", "==", "OPEN"),
      limit(1000)
    );

    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0)
    );

    return () => unsub();
  }, [enabled]);

  return count;
}

function UnreadBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (!count || count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "absolute -top-2 -right-2",
        "inline-flex min-w-[22px] h-[22px] items-center justify-center",
        "rounded-full bg-red-500 text-white text-[11px] font-black",
        "px-1.5 shadow-[0_4px_12px_rgba(239,68,68,0.6)]",
        "ring-2 ring-white",
        className
      )}
    >
      {label}
    </span>
  );
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

function IconBell({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

function IconHelp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.6 9.2A2.6 2.6 0 1 1 13 12c-.9.5-1.4 1-1.4 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 17.2h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/* =========================
   Profile Dropdown (desktop) — WHITE THEME
========================= */
function ProfileDropdown({
  uid,
  email,
  displayName,
  avatarUrl,
  onLogout,
  unreadCount,
}: {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  onLogout: () => Promise<void> | void;
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("light");
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
    setTheme("light");
    applyTheme("light");
  };

  const toggleLang = () => {
    const next: Lang = lang === "MN" ? "EN" : "MN";
    setLang(next);
    saveLang(next);
  };

  const iconBox =
    "grid h-10 w-10 place-items-center rounded-2xl bg-black/[0.03] ring-1 ring-black/10 group-hover:bg-black/[0.06] group-hover:ring-black/20 transition";
  const itemRow =
    "group flex items-center gap-3 px-4 py-3 text-[15px] font-extrabold text-black hover:bg-black/[0.04] transition";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center gap-2 rounded-full px-3 py-2 ring-1 transition",
          "bg-white text-black hover:bg-black/[0.04] ring-black/70"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UnreadBadge count={unreadCount} className="-top-2 -right-2" />

        <span
          className={cn(
            "relative h-8 w-8 overflow-hidden rounded-full ring-1",
            "ring-black/70 bg-white"
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-xs font-extrabold text-black">
              {initials}
            </span>
          )}
        </span>

        <span className="hidden sm:block max-w-[150px] truncate font-extrabold text-black">
          {displayName?.trim() ? displayName : "PROFILE"}
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl bg-white",
            "border border-black/15 ring-1 ring-black/10 shadow-[0_24px_70px_rgba(0,0,0,0.25)] z-[999]"
          )}
          role="menu"
        >
          <div className="px-5 pt-5 pb-4 border-b border-black/10">
            <div className="flex items-center gap-4">
              <span className="relative h-12 w-12 overflow-hidden rounded-3xl bg-white ring-1 ring-black/15">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-sm font-extrabold text-black">
                    {initials}
                  </span>
                )}
              </span>

              <div className="min-w-0">
                <div className="text-[16px] font-extrabold text-black truncate">
                  {displayName?.trim() ? displayName : "Хэрэглэгч"}
                </div>
                <div className="text-sm text-black/60 truncate">{email}</div>
              </div>
            </div>
          </div>

          <Link href="/profile" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconUser className="h-5 w-5 text-black/90" />
            </span>
            Профайл
          </Link>

          <Link
            href="/profile/purchases"
            onClick={() => setOpen(false)}
            className={itemRow}
            role="menuitem"
          >
            <span className={iconBox}>
              <IconReceipt className="h-5 w-5 text-black/90" />
            </span>
            Худалдан авалтын түүх
          </Link>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={itemRow}
            role="menuitem"
          >
            <span className={cn(iconBox, "relative")}>
              <IconBell className="h-5 w-5 text-black/90" />
              <UnreadBadge count={unreadCount} />
            </span>
            Шинэ мэдэгдэл
          </Link>

          <Link
            href="/request?source=menu"
            onClick={() => setOpen(false)}
            className={itemRow}
            role="menuitem"
          >
            <span className={iconBox}>
              <IconHelp className="h-5 w-5 text-black/90" />
            </span>
            Асуудал шийдүүлэх
          </Link>

          <Link href="/settings" onClick={() => setOpen(false)} className={itemRow} role="menuitem">
            <span className={iconBox}>
              <IconSettings className="h-5 w-5 text-black/90" />
            </span>
            Тохиргоо
          </Link>

          <div className="h-px bg-black/10 mx-5 my-1" />

          <button
            type="button"
            onClick={handleLogout}
            className={cn(itemRow, "text-red-600 hover:text-red-700")}
            role="menuitem"
          >
            <span className={iconBox}>
              <IconLogout className="h-5 w-5 text-red-600" />
            </span>
            Гарах
          </button>

          <div className="border-t border-black/10 px-5 py-4">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={toggleLang}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                  "bg-black/[0.03] hover:bg-black/[0.06] transition",
                  "ring-1 ring-black/10 hover:ring-black/20"
                )}
              >
                <span className="flex items-center gap-3 text-[14px] font-extrabold text-black">
                  <IconGlobe className="h-5 w-5 text-black/90" />
                  Language
                </span>
                <span className="text-xs font-extrabold text-black bg-black/[0.06] px-3 py-1.5 rounded-xl">
                  {lang}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                  "bg-black/[0.03] hover:bg-black/[0.06] transition",
                  "ring-1 ring-black/10 hover:ring-black/20"
                )}
              >
                <span className="flex items-center gap-3 text-[14px] font-extrabold text-black">
                  <IconSun className="h-5 w-5 text-black/90" />
                  Theme
                </span>
                <span className="text-xs font-extrabold text-black bg-black/[0.06] px-3 py-1.5 rounded-xl">
                  Light
                </span>
              </button>
            </div>
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
  unreadCount,
  openReqCount,
}: {
  open: boolean;
  onClose: () => void;
  isAuthed: boolean;
  onLogout: () => Promise<void> | void;
  goLogin: () => void;
  isAdmin: boolean;
  unreadCount: number;
  openReqCount: number;
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
      <button
        aria-label="Close menu overlay"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

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

              <button onClick={() => go("/admin/requests")} className={item}>
                <span className="relative inline-flex items-center">
                  Хүсэлтийн түүх
                  <UnreadBadge
                    count={openReqCount}
                    className="!relative !-top-0 !-right-0 ml-2"
                  />
                </span>
                <span className={right}>›</span>
              </button>
            </>
          )}

          {isAuthed && (
            <button onClick={() => go("/profile/purchases")} className={item}>
              <span>Худалдан авалтын түүх</span>
              <span className={right}>›</span>
            </button>
          )}

          {isAuthed && (
            <button onClick={() => go("/notifications")} className={item}>
              <span className="relative inline-flex items-center">
                Шинэ мэдэгдэл
                <UnreadBadge count={unreadCount} className="!relative !-top-0 !-right-0 ml-2" />
              </span>
              <span className={right}>›</span>
            </button>
          )}

          {isAuthed && (
            <button onClick={() => go("/request?source=menu")} className={item}>
              <span>Асуудал шийдүүлэх</span>
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
   ✅ Login Side Drawer (Header-triggered) — zadlan-like
========================= */
function LoginDrawer({
  open,
  onClose,
  callbackUrl,
}: {
  open: boolean;
  onClose: () => void;
  callbackUrl: string;
}) {
  const [mountedOpen, setMountedOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => setMountedOpen(true), 10);
      return () => window.clearTimeout(t);
    } else {
      setMountedOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999]">
     <button
  aria-label="Close login"
  onClick={onClose}
  className={cn(
    // ✅ softer dim + blur (цаад тал бүдэг)
   "absolute inset-0 bg-black/60 backdrop-blur-[5px] transition-opacity duration-200",
    mountedOpen ? "opacity-100" : "opacity-0"
  )}
/>

      <div
  className={cn(
    // ✅ Floating position (4 талдаа зай гаргана)
    "absolute right-4 top-4 bottom-4",

    // ✅ Width хэвээр
    "w-[calc(100%-2rem)] sm:w-[520px] md:w-[560px]",

    // ✅ 4 талдаа бөөрөнхий
    "bg-white rounded-[32px]",

    // ✅ Premium border + shadow
    "ring-1 ring-black/10",
    "shadow-[0_50px_160px_rgba(0,0,0,0.28)]",

    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    mountedOpen ? "translate-x-0" : "translate-x-[110%]"
  )}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative h-14 px-6 flex items-center">
          <div className="text-[12px] font-extrabold tracking-widest text-black/35">
            НЭВТРЭХ
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-full border border-black/10 bg-white hover:bg-black/[0.03] active:scale-[0.98]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="h-[calc(100%-56px)] overflow-auto">
          <div className="min-h-full flex items-center justify-center px-6 py-10">
            <LoginSheet callbackUrl={callbackUrl} initialMode="login" onClose={onClose} />
          </div>
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

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useUnreadNotiCount(user?.uid);
  const openReqCount = useOpenRequestsCount(!!user && isAdmin);

  useEffect(() => {
    applyTheme("light");
  }, []);

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

  // ✅ login drawer state
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginCb, setLoginCb] = useState<string>("/");

  const goLogin = () => {
    setLoginCb(currentUrl || "/");
    setLoginOpen(true);
  };

  const closeLogin = () => setLoginOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-transparent text-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-black/10 bg-white active:scale-[0.98]"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <IconHamburger className="h-5 w-5 text-black" />
            </button>

            <Link href="/" className="group flex items-center gap-3 select-none">
              <span className="text-sm font-black tracking-wide text-black">EBACREATOR</span>
              <span
                className={cn(
                  "hidden sm:block h-px w-10",
                  "bg-red-500",
                  "shadow-[0_0_10px_rgba(239,68,68,0.95)]"
                )}
              />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-2 text-sm">
            <Link
              className="rounded-full px-3 py-2 font-extrabold text-black hover:bg-black/[0.04]"
              href="/contents"
            >
              СУРГАЛТУУД
            </Link>

            {!loading && !user ? (
              <button
                onClick={() => {
                  setLoginCb("/my-content");
                  setLoginOpen(true);
                }}
                className="rounded-full px-3 py-2 font-extrabold text-black hover:bg-black/[0.04]"
              >
                МИНИЙ СУРГАЛТУУД
              </button>
            ) : (
              <Link
                className="rounded-full px-3 py-2 font-extrabold text-black hover:bg-black/[0.04]"
                href="/my-content"
              >
                МИНИЙ СУРГАЛТУУД
              </Link>
            )}

            {!loading && user && isAdmin && (
              <div ref={adminRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAdminOpen((v) => !v)}
                  onMouseEnter={() => setAdminOpen(true)}
                  className={cn(
                    "relative rounded-full px-3 py-2 font-extrabold text-black",
                    "hover:bg-black/[0.04]",
                    adminOpen && "bg-black/[0.04]"
                  )}
                  aria-haspopup="menu"
                  aria-expanded={adminOpen}
                >
                  <UnreadBadge count={openReqCount} className="-top-2 -right-2" />
                  АДМИН
                </button>

                {adminOpen && (
                  <div
                    onMouseLeave={() => setAdminOpen(false)}
                    className={cn(
                      "absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl",
                      "bg-white text-black",
                      "border border-black/15 shadow-[0_20px_60px_rgba(0,0,0,0.25)]",
                      "ring-1 ring-black/10 z-[999]"
                    )}
                    role="menu"
                  >
                    <Link
                      href="/admin"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-3 text-sm font-extrabold text-black hover:bg-black/[0.04]"
                      role="menuitem"
                    >
                      ADMIN Home
                    </Link>
                    <div className="h-px bg-black/10" />
                    <Link
                      href="/admin/users"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-3 text-sm font-extrabold text-black hover:bg-black/[0.04]"
                      role="menuitem"
                    >
                      USERS
                    </Link>
                    <Link
                      href="/admin/banner"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-3 text-sm font-extrabold text-black hover:bg-black/[0.04]"
                      role="menuitem"
                    >
                      Banner
                    </Link>
                    <Link
                      href="/analist"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-3 text-sm font-extrabold text-black hover:bg-black/[0.04]"
                      role="menuitem"
                    >
                      ANALIST
                    </Link>

                    <Link
                      href="/admin/requests"
                      onClick={() => setAdminOpen(false)}
                      className="block px-4 py-3 text-sm font-extrabold text-black hover:bg-black/[0.04]"
                      role="menuitem"
                    >
                      <span className="relative inline-flex items-center">
                        Хүсэлтийн түүх
                        <UnreadBadge
                          count={openReqCount}
                          className="!relative !-top-0 !-right-0 ml-2"
                        />
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {loading && <div className="ml-2 h-9 w-24 rounded-full bg-black/5 animate-pulse" />}

            {!loading && !user && (
              <button
                onClick={goLogin}
                className="rounded-full bg-white px-3 py-2 font-extrabold text-black ring-1 ring-black/70 hover:bg-black/[0.04]"
              >
                НЭВТРЭХ
              </button>
            )}

            {!loading && user && (
              <div className="flex items-center gap-2">
                <ProfileDropdown
                  uid={user.uid}
                  email={user.email || ""}
                  displayName={userDoc?.name || ""}
                  avatarUrl={(userDoc as any)?.avatarUrl || ""}
                  onLogout={onLogout}
                  unreadCount={unreadCount}
                />
              </div>
            )}
          </nav>

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

        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          isAuthed={!!user}
          onLogout={onLogout}
          goLogin={goLogin}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
          openReqCount={openReqCount}
        />
      </header>

      <LoginDrawer open={loginOpen} onClose={closeLogin} callbackUrl={loginCb} />
    </>
  );
}