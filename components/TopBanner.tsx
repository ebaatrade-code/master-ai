"use client";

import Link from "next/link";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { db } from "@/lib/firebase";

type BannerHref =
  | string
  | { type: "course"; courseId: string }
  | { type: "url"; url: string };

type BannerConfig = {
  enabled?: boolean;
  text?: string;
  variant?: "promo" | "info" | "success" | "danger";
  href?: BannerHref;
  dismissible?: boolean;
  cooldownHours?: number;

  // ✅ NEW
  startAt?: Timestamp | null;
  endAt?: Timestamp | null;
  pages?: string[]; // ["/", "/contents", "/course/*"] гэх мэт
};

type SiteConfig = { banner?: BannerConfig };

function normalizeHref(href?: BannerHref): string | null {
  if (!href) return null;
  if (typeof href === "string") return href || null;
  if (href.type === "course") return href.courseId ? `/course/${href.courseId}` : null;
  if (href.type === "url") return href.url || null;
  return null;
}

function variantClasses(variant: BannerConfig["variant"]) {
  switch (variant) {
    case "promo":
      return "bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 text-white";
    case "success":
      return "bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 text-white";
    case "danger":
      return "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white";
    case "info":
    default:
      return "bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white";
  }
}

// ✅ "/course/*" мэт wildcard-тай match
function matchPage(pattern: string, path: string) {
  const p = (pattern || "").trim();
  if (!p) return false;
  if (p === "*") return true;
  if (p === path) return true;

  // wildcard: "/course/*" => "/course/"
  if (p.endsWith("/*")) {
    const base = p.slice(0, -1); // "/course/"
    return path.startsWith(base);
  }
  return false;
}

function msToParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function TopBanner() {
  const pathname = usePathname();

  const [cfg, setCfg] = useState<BannerConfig | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ⏱️ секунд тутам countdown шинэчлэх
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Firestore realtime
  useEffect(() => {
    const ref = doc(db, "siteConfig", "global");
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() || {}) as SiteConfig;
      setCfg(data.banner ?? null);
    });
    return () => unsub();
  }, []);

  const enabled = !!cfg?.enabled;
  const text = (cfg?.text || "").trim();
  const href = useMemo(() => normalizeHref(cfg?.href), [cfg?.href]);
  const dismissible = cfg?.dismissible !== false;
  const cooldownHours = Math.max(1, Number(cfg?.cooldownHours ?? 24));

  // ✅ pages filter
  const pages = (cfg?.pages || []).map((x) => (x || "").trim()).filter(Boolean);
  const pageAllowed = useMemo(() => {
    if (!pages.length) return true; // pages байхгүй бол бүх page дээр гаргана
    return pages.some((p) => matchPage(p, pathname || "/"));
  }, [pages, pathname]);

  // ✅ start/end window
  const startMs = cfg?.startAt?.toMillis?.() ?? null;
  const endMs = cfg?.endAt?.toMillis?.() ?? null;

  const notStartedYet = startMs != null && now < startMs;
  const expired = endMs != null && now >= endMs;

  // ✅ dismiss logic (localStorage)
  const dismissKey = useMemo(() => {
    const v = `${text}|${href || ""}|${cfg?.variant || "info"}|${startMs ?? ""}|${endMs ?? ""}`;
    let hash = 0;
    for (let i = 0; i < v.length; i++) hash = (hash * 31 + v.charCodeAt(i)) >>> 0;
    return `topBannerDismissed:v2:${hash}`;
  }, [text, href, cfg?.variant, startMs, endMs]);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      if (!raw) return;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return;
      const ms = cooldownHours * 60 * 60 * 1000;
      if (Date.now() - ts < ms) setDismissed(true);
    } catch {}
  }, [dismissKey, cooldownHours]);

  // ✅ show/hide rules
  if (!enabled || !text) return null;
  if (!pageAllowed) return null;
  if (dismissed && dismissible) return null;
  if (notStartedYet) return null;
  if (expired) return null;

  // ✅ countdown
  const remainingMs = endMs != null ? endMs - now : null;
  const parts = remainingMs != null ? msToParts(remainingMs) : null;

  const barClass = variantClasses(cfg?.variant);

  return (
    <div className={`${barClass} relative z-40`}>
      <div className="mx-auto flex max-w-7xl items-start sm:items-center justify-between gap-3 px-4 py-3">
       {/* Left: badge + text */}
<div
  className="
    flex min-w-0 flex-col gap-1
    text-[13px] leading-snug font-semibold
    sm:flex-row sm:items-center sm:gap-2 sm:text-sm
  "
>
        <span
  className="
    w-fit shrink-0 rounded-full
    bg-white/20 px-2 py-0.5
    text-[10px] font-bold tracking-wide
    sm:text-[11px]
  "
>
            LIMITED OFFER
          </span>

          {href ? (
           <Link
  href={href}
  className="
    min-w-0
    whitespace-normal break-words
    leading-snug
    sm:truncate sm:whitespace-nowrap
    hover:underline underline-offset-4
  "
>
              {text}
            </Link>
          ) : (
            <span className="min-w-0 whitespace-normal break-words sm:truncate sm:whitespace-nowrap">
              {text}
            </span>
          )}
        </div>

        {/* Right: countdown + CTA + close */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Countdown */}
          {parts ? (
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 text-xs font-bold">
              <span className="text-white/90">⏳</span>
              <span className="tabular-nums">
                {pad2(parts.h)}:{pad2(parts.m)}:{pad2(parts.s)}
              </span>
            </div>
          ) : null}

          {/* CTA */}
          {href ? (
            <Link
              href={href}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
            >
              ҮЗЭХ →
            </Link>
          ) : null}

          {/* Close */}
          {dismissible ? (
            <button
              onClick={() => {
                try {
                  localStorage.setItem(dismissKey, String(Date.now()));
                } catch {}
                setDismissed(true);
              }}
              className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"
              aria-label="Close banner"
              title="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}