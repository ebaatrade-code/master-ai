"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Props = {
  isAuthed: boolean;
  loadingAuth?: boolean;
  onLogin: () => void;
  onLogout?: () => void;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

/* ── Unread badge ─────────────────────────────────────────── */
function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "absolute -top-1.5 -right-1.5",
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

/* ── Nav link with optional active highlight ──────────────── */
function SideNavLink({
  href,
  label,
  icon,
  active,
  onGo,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onGo: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onGo}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-[11px] text-[15px] font-semibold transition-colors",
        active
          ? "bg-amber-400 text-amber-900 font-bold"
          : "text-black/70 hover:bg-black/[0.04] active:bg-black/[0.07]"
      )}
    >
      <span className={cn("flex-shrink-0", active ? "text-amber-800" : "text-black/45")}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}

/* ── Nav link with notification badge ────────────────────── */
function SideNavLinkBadge({
  href,
  label,
  icon,
  badge,
  active,
  onGo,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge: number;
  active?: boolean;
  onGo: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onGo}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-[11px] text-[15px] font-semibold transition-colors",
        active
          ? "bg-amber-400 text-amber-900 font-bold"
          : "text-black/70 hover:bg-black/[0.04] active:bg-black/[0.07]"
      )}
    >
      <span className={cn("flex-shrink-0", active ? "text-amber-800" : "text-black/45")}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-black px-1.5">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ── Nav button (unauthenticated state) ───────────────────── */
function SideNavButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-[11px] text-[15px] font-semibold text-black/70 hover:bg-black/[0.04] active:bg-black/[0.07] transition-colors"
    >
      <span className="flex-shrink-0 text-black/45">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

/* ── Section label ───────────────────────────────────────── */
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[10px] font-extrabold tracking-[0.20em] text-black/35 uppercase">
      {label}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function MobileHeader({
  isAuthed,
  loadingAuth,
  onLogin,
  onLogout,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { user } = useAuth();

  /* scroll shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ESC close */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* realtime unread count */
  useEffect(() => {
    if (!isAuthed) {
      setUnreadCount(0);
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let c = 0;
        snap.forEach((d) => {
          const data: any = d.data();
          if (!data?.readAt && data?.read !== true) c += 1;
        });
        setUnreadCount(c);
      },
      () => setUnreadCount(0)
    );
    return () => unsub();
  }, [isAuthed]);

  /* user display info */
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Хэрэглэгч";
  const joinYear = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getFullYear()
    : null;
  const photoURL = user?.photoURL;
  const initials = displayName.slice(0, 2).toUpperCase();

  const closeDrawer = () => setDrawerOpen(false);
  const openDrawer = () => setDrawerOpen(true);

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header
        className={cn(
          "md:hidden sticky top-0 z-50 w-full bg-white border-b border-black/10",
          scrolled && "shadow-[0_8px_22px_rgba(0,0,0,0.10)]"
        )}
      >
        <div className="mx-auto flex items-center justify-between px-3 h-[calc(48px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
          {/* hamburger */}
          <button
            onClick={openDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Цэс нээх"
          >
            <BurgerIcon />
          </button>

          {/* logo */}
          <Link
            href="/"
            className="truncate text-[12px] font-extrabold tracking-[0.28em] text-black/80"
          >
            EBACREATOR
          </Link>

          {/* right: profile button (also opens drawer) + unread badge */}
          <button
            onClick={openDrawer}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Профайл нээх"
          >
            {isAuthed && <UnreadBadge count={unreadCount} />}
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <UserIcon />
            )}
          </button>
        </div>
        <div className="pointer-events-none h-4 w-full bg-gradient-to-b from-white to-transparent" />
      </header>

      {/* ── UNIFIED DRAWER ──────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-[70] md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!drawerOpen}
      >
        {/* backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/35 transition-opacity duration-200",
            drawerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeDrawer}
        />

        {/* panel */}
        <div
          className={cn(
            "absolute top-0 left-0 h-full w-[86%] max-w-[340px] bg-white",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_40px_120px_rgba(0,0,0,0.25)]",
            "transition-transform duration-200 ease-out",
            "flex flex-col overflow-y-auto",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* close button */}
          <div className="flex justify-end px-4 pt-4 pb-0">
            <button
              onClick={closeDrawer}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
              aria-label="Хаах"
            >
              <XIcon />
            </button>
          </div>

          {/* ── PROFILE HEADER ──────────────────────────────── */}
          {loadingAuth ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="h-[60px] w-[60px] rounded-full bg-black/10 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-black/10 rounded animate-pulse" />
                <div className="h-3 w-16 bg-black/10 rounded animate-pulse" />
              </div>
            </div>
          ) : isAuthed ? (
            <div className="flex items-center gap-4 px-5 py-4">
              {/* avatar */}
              <div className="h-[64px] w-[64px] flex-shrink-0 rounded-full border-[3px] border-amber-400 bg-amber-50 overflow-hidden flex items-center justify-center">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-amber-700 font-black text-[20px] leading-none">
                    {initials}
                  </span>
                )}
              </div>
              {/* info */}
              <div className="min-w-0">
                <div className="text-[16px] font-extrabold text-black leading-tight truncate">
                  {displayName}
                </div>
                <div className="text-[13px] text-black/50 mt-0.5">Гишүүн</div>
                {joinYear && (
                  <div className="text-[10px] font-bold tracking-[0.14em] text-black/30 uppercase mt-1">
                    НЭГДСЭН {joinYear}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* not logged in → login prompt */
            <div className="px-5 py-4">
              <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
                <div className="text-sm font-semibold text-black">Нэвтрэх</div>
                <div className="mt-1 text-xs text-black/55">
                  Профайл руу орохын тулд нэвтэрнэ.
                </div>
                <button
                  onClick={() => {
                    onLogin();
                    closeDrawer();
                  }}
                  className="mt-4 w-full rounded-xl bg-amber-400 text-amber-900 px-4 py-3 text-sm font-bold active:scale-[0.99] transition"
                >
                  Нэвтрэх
                </button>
              </div>
            </div>
          )}

          {/* divider */}
          <div className="mx-5 border-t border-black/[0.07]" />

          {/* ── АКАДЕМИК section ────────────────────────────── */}
          <div className="px-3 flex-1">
            <SectionLabel label="Академик" />
            <SideNavLink
              href="/contents"
              label="Сургалтууд"
              icon={<CoursesIcon />}
              active={
                pathname === "/contents" ||
                pathname.startsWith("/contents/") ||
                pathname === "/courses" ||
                pathname.startsWith("/courses/")
              }
              onGo={closeDrawer}
            />
            {isAuthed ? (
              <SideNavLink
                href="/my-content"
                label="Миний сургалтууд"
                icon={<MyCourseIcon />}
                active={
                  pathname === "/my-content" ||
                  pathname.startsWith("/my-content/")
                }
                onGo={closeDrawer}
              />
            ) : (
              <SideNavButton
                label="Миний сургалтууд"
                icon={<MyCourseIcon />}
                onClick={() => {
                  closeDrawer();
                  onLogin();
                }}
              />
            )}
            {isAuthed ? (
              <SideNavLink
                href="/profile/purchases"
                label="Худалдан авалтын түүх"
                icon={<PurchaseIcon />}
                active={pathname === "/profile/purchases"}
                onGo={closeDrawer}
              />
            ) : (
              <SideNavButton
                label="Худалдан авалтын түүх"
                icon={<PurchaseIcon />}
                onClick={() => {
                  closeDrawer();
                  onLogin();
                }}
              />
            )}

            {/* ── БҮРТГЭЛ section ─────────────────────────── */}
            {isAuthed && (
              <>
                <SectionLabel label="Бүртгэл" />
                <SideNavLink
                  href="/profile"
                  label="Профайл"
                  icon={<ProfileIcon />}
                  active={pathname === "/profile"}
                  onGo={closeDrawer}
                />
                <SideNavLinkBadge
                  href="/notifications"
                  label="Мэдэгдэлүүд"
                  icon={<BellIcon />}
                  badge={unreadCount}
                  active={pathname === "/notifications"}
                  onGo={closeDrawer}
                />
                <SideNavLink
                  href="/request?source=mobile_menu"
                  label="Тусламж"
                  icon={<HelpIcon />}
                  active={pathname === "/request"}
                  onGo={closeDrawer}
                />
              </>
            )}
          </div>

          {/* ── LOGOUT ────────────────────────────────────── */}
          {isAuthed && (
            <div className="px-4 py-5">
              <button
                onClick={() => {
                  onLogout?.();
                  closeDrawer();
                }}
                className="w-full rounded-xl bg-red-500 text-white px-4 py-3 text-sm font-semibold shadow-[0_8px_25px_rgba(239,68,68,0.30)] hover:bg-red-400 active:scale-[0.99] transition"
              >
                Гарах
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   ICONS  (24×24 viewBox, stroke-based)
════════════════════════════════════════════════════════════ */
function BurgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21a8 8 0 0 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CoursesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MyCourseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 12v5c3.33 1.67 8.67 1.67 12 0v-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PurchaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="9"
        y="3"
        width="6"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20c0-4 3.58-7 8-7s8 3 8 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
