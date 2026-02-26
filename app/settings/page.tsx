"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail, updatePassword } from "firebase/auth";

type ToastType = "ok" | "err" | "info";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- localStorage keys ----------
const LS_THEME = "ma:theme"; // "dark" | "light"
const LS_LANG = "ma:lang"; // "mn" | "en"
const LS_TEXT = "ma:text"; // "normal" | "large"

function getLS(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}
function setLS(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

// ---------- icons (inline SVG) ----------
function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "shield"
    | "key"
    | "mail"
    | "clock"
    | "palette"
    | "globe"
    | "text"
    | "sun"
    | "moon"
    | "check"
    | "copy";
  className?: string;
}) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "shield":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" />
        </svg>
      );
    case "key":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M21 10l-4 4h-2l-1 1v2h-2v2H9v-3l4.2-4.2" />
          <circle cx="7.5" cy="10.5" r="3.5" />
        </svg>
      );
    case "mail":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 6h16v12H4z" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </svg>
      );
    case "palette":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3a9 9 0 0 0 0 18h2a3 3 0 0 0 0-6h-1a2 2 0 0 1 0-4h3a5 5 0 0 0-4-8z" />
          <path d="M7.5 10.5h.01" />
          <path d="M9.5 7.5h.01" />
          <path d="M14.5 7.5h.01" />
          <path d="M16.5 10.5h.01" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c3 3 3 15 0 18" />
          <path d="M12 3c-3 3-3 15 0 18" />
        </svg>
      );
    case "text":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 6h16" />
          <path d="M7 6v14" />
          <path d="M17 6v14" />
          <path d="M9 20h6" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M19.8 4.2l-2.1 2.1M6.3 17.7l-2.1 2.1" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3a6.5 6.5 0 1 0 11.5 11.5z" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 9h10v10H9z" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      );
  }
}

/* =========================
   Light tokens (Apple-like)
========================= */
// ✅ Stroke = subtle gray, not white
const STROKE = "border-black/10";
const STROKE_STRONG = "border-black/14";

// ✅ Shadows: soft + layered (not heavy)
const SHADOW_CARD = "shadow-[0_18px_55px_rgba(0,0,0,0.10)]";
const SHADOW_INNER = "shadow-[0_0_0_1px_rgba(0,0,0,0.04)]";
const SHADOW_HOVER = "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_18px_55px_rgba(0,0,0,0.12)]";

function Pill({
  active,
  onClick,
  leftIcon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  leftIcon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-2xl border bg-white px-4 py-3 text-left transition",
        SHADOW_INNER,
        SHADOW_HOVER,
        active ? `${STROKE_STRONG}` : `${STROKE}`
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-2xl border bg-white",
            SHADOW_INNER,
            active ? STROKE_STRONG : STROKE
          )}
        >
          <span className="text-black/85">{leftIcon}</span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-black text-black">{title}</div>

            {active && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] font-extrabold text-black",
                  STROKE,
                  SHADOW_INNER
                )}
              >
                <Icon name="check" className="h-3.5 w-3.5" />
                Сонгосон
              </span>
            )}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-neutral-600">{subtitle}</div>}
        </div>
      </div>
    </button>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-white p-5", STROKE, SHADOW_INNER)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("grid h-10 w-10 place-items-center rounded-2xl border bg-white", STROKE, SHADOW_INNER)}>
            <span className="text-black/85">{icon}</span>
          </div>
          <div>
            <div className="text-sm font-black text-black">{title}</div>
            {subtitle ? <div className="text-xs font-semibold text-neutral-600">{subtitle}</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-extrabold text-neutral-700">{label}</div>
      <input
        className={cn(
          "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-black placeholder:text-neutral-400 outline-none transition",
          STROKE,
          SHADOW_INNER,
          "focus:border-black/20 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, userDoc, loading } = useAuth();

  const [toast, setToast] = useState<{ type: ToastType; text: string } | null>(null);
  const showToast = (type: ToastType, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login?callbackUrl=%2Fsettings");
  }, [loading, user, router]);

  // ---- Preferences state (localStorage) ----
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lang, setLang] = useState<"mn" | "en">("mn");
  const [textSize, setTextSize] = useState<"normal" | "large">("normal");

  useEffect(() => {
    setTheme((getLS(LS_THEME, "dark") as any) || "dark");
    setLang((getLS(LS_LANG, "mn") as any) || "mn");
    setTextSize((getLS(LS_TEXT, "normal") as any) || "normal");
  }, []);

  const savePrefs = () => {
    setLS(LS_THEME, theme);
    setLS(LS_LANG, lang);
    setLS(LS_TEXT, textSize);
    showToast("ok", "Хадгалагдлаа ✅");
  };

  // ---- Security actions ----
  const email = useMemo(() => user?.email || userDoc?.email || "", [user?.email, userDoc?.email]);
  const lastLoginText = useMemo(
    () => formatDateTime(user?.metadata?.lastSignInTime || ""),
    [user?.metadata?.lastSignInTime]
  );

  const canChangePassword = userDoc?.authMethod === "email";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const sendReset = async () => {
    if (!email) return showToast("err", "Email олдсонгүй.");
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("ok", "Reset email илгээлээ ✅");
    } catch (e: any) {
      console.error(e);
      showToast("err", e?.message || "Reset алдаа");
    } finally {
      setResetSending(false);
    }
  };

  const changePassword = async () => {
    if (!canChangePassword) return showToast("info", "Google хэрэглэгчид нууц үг солих шаардлагагүй.");
    if (!user) return;
    if (pw1.trim().length < 6) return showToast("err", "Нууц үг min 6 тэмдэгт.");
    if (pw1 !== pw2) return showToast("err", "Нууц үг таарахгүй байна.");

    setPwSaving(true);
    try {
      await updatePassword(user, pw1);
      setPw1("");
      setPw2("");
      showToast("ok", "Нууц үг солигдлоо ✅");
    } catch (e: any) {
      console.error(e);
      if (String(e?.code || "").includes("requires-recent-login")) {
        showToast("err", "Сүүлд нэвтэрсэн баталгаажуулалт хэрэгтэй. Reset email-ээр сольж болно.");
      } else {
        showToast("err", e?.message || "Нууц үг солих алдаа");
      }
    } finally {
      setPwSaving(false);
    }
  };

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      showToast("ok", "Email copy ✅");
    } catch {
      showToast("err", "Copy болохгүй байна");
    }
  };

  // ---- Premium layout styles (LIGHT) ----
  const sectionLine = "pt-8 mt-8"; // ✅ remove divider line (clean)
  const panel =
    cn(
      "rounded-3xl border bg-white p-6",
      STROKE,
      SHADOW_CARD
    );

  const outlineBtn =
    cn(
      "rounded-full border bg-white px-4 py-2 text-sm font-extrabold text-black transition",
      STROKE,
      SHADOW_INNER,
      SHADOW_HOVER
    );

  const chip =
    cn(
      "inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs text-black",
      STROKE,
      SHADOW_INNER
    );

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-black">
      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-black">Тохиргоо</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className={chip}>
              <Icon name="clock" className="h-4 w-4" />
              <span className="font-extrabold">Сүүлд:</span>
              <span className="text-black/70 font-semibold">{lastLoginText}</span>
            </div>

            <Link href="/profile" className={outlineBtn}>
              Profile
            </Link>

            <Link href="/my-content" className={outlineBtn}>
              Progress
            </Link>

            <button
              type="button"
              onClick={savePrefs}
              className={cn(
                "rounded-full bg-white px-5 py-2 text-sm font-black text-black transition hover:opacity-90 disabled:opacity-60"
              )}
            >
              Хадгалах
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "mt-6 rounded-2xl border bg-white px-4 py-3 text-sm",
              STROKE,
              SHADOW_INNER,
              toast.type === "ok" && "text-emerald-700",
              toast.type === "err" && "text-red-700",
              toast.type === "info" && "text-neutral-700"
            )}
          >
            <span className="font-extrabold">{toast.text}</span>
          </div>
        )}

        {/* Security */}
        <section className={sectionLine}>
          <div className="text-xl font-black text-black">Аюулгүй байдал</div>

          <div className={cn("mt-5", panel)}>
            <div className="grid gap-5 md:grid-cols-2">
              {/* Reset */}
              <SectionCard
                icon={<Icon name="mail" className="h-5 w-5" />}
                title="Нууц үг сэргээх"
                subtitle="Reset холбоос илгээнэ"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn("inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs text-black", STROKE, SHADOW_INNER)}>
                    <Icon name="mail" className="h-4 w-4" />
                    <span className="font-extrabold">{email || "—"}</span>
                  </div>

                  <button
                    type="button"
                    onClick={copyEmail}
                    disabled={!email}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-extrabold text-black transition disabled:opacity-60",
                      STROKE,
                      SHADOW_INNER,
                      SHADOW_HOVER
                    )}
                  >
                    <Icon name="copy" className="h-4 w-4" />
                    Copy
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={resetSending || !email}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f5d37b] px-4 py-2 text-sm font-black text-black hover:opacity-90 disabled:opacity-60"
                  >
                    <Icon name="mail" className="h-4 w-4" />
                    {resetSending ? "Илгээж байна..." : "Reset email илгээх"}
                  </button>
                </div>
              </SectionCard>

              {/* Change password */}
              <SectionCard
                icon={<Icon name="key" className="h-5 w-5" />}
                title="Нууц үг солих"
                subtitle={canChangePassword ? "Email/Password" : "Google (унтраалттай)"}
              >
                <div className="grid gap-3">
                  <Field
                    label="Шинэ нууц үг"
                    value={pw1}
                    onChange={setPw1}
                    disabled={!canChangePassword}
                    type="password"
                    placeholder="min 6"
                  />
                  <Field
                    label="Дахин"
                    value={pw2}
                    onChange={setPw2}
                    disabled={!canChangePassword}
                    type="password"
                    placeholder="Дахин бич"
                  />
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={changePassword}
                    disabled={!canChangePassword || pwSaving}
                    className={cn(
                      "w-full rounded-full border bg-white py-2.5 text-sm font-black text-black transition disabled:opacity-60",
                      STROKE,
                      SHADOW_INNER,
                      SHADOW_HOVER
                    )}
                  >
                    {pwSaving ? "Сольж байна..." : "Нууц үг солих"}
                  </button>
                </div>
              </SectionCard>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className={sectionLine}>
          <div className="text-xl font-black text-black">Харагдац & Хэл</div>

          <div className={cn("mt-5", panel)}>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Theme */}
              <SectionCard icon={<Icon name="palette" className="h-5 w-5" />} title="Theme" subtitle="Dark / Light">
                <div className="grid gap-2">
                  <Pill
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    leftIcon={<Icon name="moon" />}
                    title="Dark"
                    subtitle=" "
                  />
                  <Pill
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    leftIcon={<Icon name="sun" />}
                    title="Light"
                    subtitle=" "
                  />
                </div>
              </SectionCard>

              {/* Language */}
              <SectionCard icon={<Icon name="globe" className="h-5 w-5" />} title="Language" subtitle="MN / EN">
                <div className="grid gap-2">
                  <Pill
                    active={lang === "mn"}
                    onClick={() => setLang("mn")}
                    leftIcon={<span className="text-sm font-black text-black">MN</span>}
                    title="Монгол"
                    subtitle="mn-MN"
                  />
                  <Pill
                    active={lang === "en"}
                    onClick={() => setLang("en")}
                    leftIcon={<span className="text-sm font-black text-black">EN</span>}
                    title="English"
                    subtitle="en-US"
                  />
                </div>
              </SectionCard>

              {/* Text size */}
              <SectionCard icon={<Icon name="text" className="h-5 w-5" />} title="Text size" subtitle="Normal / Large">
                <div className="grid gap-2">
                  <Pill
                    active={textSize === "normal"}
                    onClick={() => setTextSize("normal")}
                    leftIcon={<span className="text-sm font-black text-black">Aa</span>}
                    title="Normal"
                    subtitle=" "
                  />
                  <Pill
                    active={textSize === "large"}
                    onClick={() => setTextSize("large")}
                    leftIcon={<span className="text-sm font-black text-black">AA</span>}
                    title="Large"
                    subtitle=" "
                  />
                </div>
              </SectionCard>
            </div>
          </div>
        </section>

        <div className="h-10" />
      </div>
    </div>
  );
}