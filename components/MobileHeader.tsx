"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  isAuthed: boolean;
  loadingAuth?: boolean;
  onLogin: () => void;
  onLogout?: () => void;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function MobileHeader({
  isAuthed,
  loadingAuth,
  onLogin,
  onLogout,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeAll = () => {
    setMenuOpen(false);
    setProfileOpen(false);
  };

  return (
    <>
      {/* TOP BAR (mobile only) */}
      <header
        className={cn(
          "md:hidden sticky top-0 z-50 w-full",
          "text-black",
          "bg-white",
          "border-b border-black/10",
          scrolled && "shadow-[0_8px_22px_rgba(0,0,0,0.10)]"
        )}
      >
        <div className="mx-auto flex items-center justify-between px-3 h-[calc(48px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
          {/* Left: hamburger */}
          <button
            onClick={() => {
              setProfileOpen(false);
              setMenuOpen(true);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Open menu"
          >
            <BurgerIcon />
          </button>

          {/* Center: logo */}
          <Link
            href="/"
            className="truncate text-[12px] font-extrabold tracking-[0.28em] text-black/80"
          >
            EBACREATOR
          </Link>

          {/* Right: profile */}
          <button
            onClick={() => {
              setMenuOpen(false);
              setProfileOpen(true);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Open profile"
          >
            <UserIcon />
          </button>
        </div>

        {/* subtle fade */}
        <div className="pointer-events-none h-4 w-full bg-gradient-to-b from-white to-transparent" />
      </header>

      {/* ✅ MENU DRAWER */}
      <Overlay open={menuOpen} onClose={closeAll} side="left" title="MENU">
        <div className="space-y-3">
          {/* ✅ /courses биш /contents */}
          <DrawerLink href="/contents" label="Сургалтууд" onGo={closeAll} />

          {/* ✅ Миний сургалтууд */}
          {isAuthed ? (
            <DrawerLink href="/my-content" label="Миний сургалтууд" onGo={closeAll} />
          ) : (
            <DrawerButton
              label="Миний сургалтууд"
              onClick={() => {
                closeAll();
                onLogin();
              }}
            />
          )}

          {/* ✅ NEW: Худалдан авалтын түүх (MENU дээр 2-ын доор) */}
          {isAuthed ? (
            <DrawerLink
              href="/profile/purchases"
              label="Худалдан авалтын түүх"
              onGo={closeAll}
            />
          ) : (
            <DrawerButton
              label="Худалдан авалтын түүх"
              onClick={() => {
                closeAll();
                onLogin(); // нэвтрээгүй бол login руу явуулна
              }}
            />
          )}
        </div>
      </Overlay>

      {/* PROFILE DRAWER */}
      <Overlay open={profileOpen} onClose={closeAll} side="right" title="PROFILE">
        <div className="space-y-3">
          {loadingAuth ? (
            <div className="h-10 w-full animate-pulse rounded-xl bg-black/10" />
          ) : isAuthed ? (
            <>
              <Link
                href="/profile"
                onClick={closeAll}
                className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-[15px] font-extrabold text-black active:scale-[0.99]"
              >
                <span>Профайл</span>
                <span className="text-black/40 text-lg leading-none">›</span>
              </Link>

              <button
                onClick={() => {
                  onLogout?.();
                  closeAll();
                }}
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                Гарах
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
              <div className="text-sm font-semibold text-black">Нэвтрэх</div>
              <div className="mt-1 text-xs text-black/60">
                Профайл руу орохын тулд нэвтэрнэ.
              </div>

              <button
                onClick={() => {
                  onLogin();
                  closeAll();
                }}
                className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                Нэвтрэх
              </button>
            </div>
          )}
        </div>
      </Overlay>
    </>
  );
}

function DrawerLink({
  href,
  label,
  onGo,
}: {
  href: string;
  label: string;
  onGo: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onGo}
      className="
        flex items-center justify-between
        rounded-xl border border-black/10 bg-black/[0.03]
        px-4 py-3
        text-[15px] font-extrabold text-black
        hover:bg-black/[0.05]
        active:scale-[0.99]
      "
    >
      <span>{label}</span>
      <span className="text-black/40 text-lg leading-none">›</span>
    </Link>
  );
}

function DrawerButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex w-full items-center justify-between
        rounded-xl border border-black/10 bg-black/[0.03]
        px-4 py-3
        text-[15px] font-extrabold text-black
        hover:bg-black/[0.05]
        active:scale-[0.99]
      "
    >
      <span>{label}</span>
      <span className="text-black/40 text-lg leading-none">›</span>
    </button>
  );
}

function Overlay({
  open,
  onClose,
  side,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/35 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute top-0 h-full w-[86%] max-w-[360px] bg-white",
          "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_40px_120px_rgba(0,0,0,0.25)]",
          "transition-transform duration-200 ease-out",
          side === "left" ? "left-0" : "right-0",
          open
            ? "translate-x-0"
            : side === "left"
            ? "-translate-x-full"
            : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-xs font-extrabold tracking-[0.18em] text-black/70">
            {title}
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

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
      <path
        d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
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