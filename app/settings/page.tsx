"use client";

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
const LS_THEME = "ma:theme";
const LS_LANG = "ma:lang";
const LS_TEXT = "ma:text";

function getLS(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}
function setLS(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

// ---------- icons ----------
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
    | "copy"
    | "bell"
    | "lock";
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
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
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
    case "bell":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
  }
}

/* ── Segment Control ── */
function SegmentControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-neutral-100 p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition",
            value === opt.key
              ? "bg-white text-neutral-900 shadow-sm font-semibold"
              : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
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

  // ---- Preferences state ----
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

  // ---- Security ----
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

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-[720px] px-5 pb-20 pt-10">

        {/* ── Header ── */}
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Тохиргоо</h1>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Icon name="clock" className="h-3.5 w-3.5" />
              Сүүлд: {lastLoginText}
            </div>
          </div>
        </div>

        {/* spacer after header */}
        <div className="mb-8" />

        {/* ── Toast ── */}
        {toast && (
          <div
            className={cn(
              "mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
              toast.type === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              toast.type === "err" && "border-red-200 bg-red-50 text-red-700",
              toast.type === "info" && "border-neutral-200 bg-neutral-50 text-neutral-700"
            )}
          >
            {toast.type === "ok" && <Icon name="check" className="h-4 w-4" />}
            {toast.text}
          </div>
        )}

        {/* ══════════════════════════════════════
           Section: Аюулгүй байдал
           ══════════════════════════════════════ */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-neutral-800">
            <Icon name="lock" className="h-4 w-4 text-neutral-400" />
            Аюулгүй байдал
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* Row: Email + Reset */}
            <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <Icon name="mail" className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">И-мэйл хаяг</div>
                  <div className="text-[11px] text-neutral-400">Нууц үг сэргээх холбоос илгээнэ</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-500">
                  <Icon name="mail" className="h-3.5 w-3.5" />
                  {email || "—"}
                </span>
                <button
                  type="button"
                  onClick={copyEmail}
                  disabled={!email}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
                >
                  <Icon name="copy" className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={sendReset}
                  disabled={resetSending || !email}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  <Icon name="mail" className="h-3.5 w-3.5" />
                  {resetSending ? "Илгээж байна..." : "Reset илгээх"}
                </button>
              </div>
            </div>

            {/* Row: Password header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                <Icon name="key" className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-800">Нууц үг солих</div>
                <div className="text-[11px] text-neutral-400">
                  {canChangePassword ? "Email/Password ашиглан нэвтэрдэг бол" : "Google (унтраалттай)"}
                </div>
              </div>
            </div>

            {/* Password form */}
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Шинэ нууц үг</label>
                  <input
                    type="password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    disabled={!canChangePassword}
                    placeholder="Хамгийн багадаа 6 тэмдэгт"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Дахин бичих</label>
                  <input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    disabled={!canChangePassword}
                    placeholder="Нууц үгээ давтана уу"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={!canChangePassword || pwSaving}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="lock" className="h-3.5 w-3.5" />
                  {pwSaving ? "Сольж байна..." : "Нууц үг солих"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
           Section: Харагдац & Хэл
           ══════════════════════════════════════ */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-neutral-800">
            <Icon name="palette" className="h-4 w-4 text-neutral-400" />
            Харагдац & Хэл
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* Row: Theme */}
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <Icon name="palette" className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Theme</div>
                  <div className="text-[11px] text-neutral-400">Харанхуй эсвэл цайвар горим</div>
                </div>
              </div>
              <SegmentControl
                options={[
                  { key: "light", label: "Light", icon: <Icon name="sun" className="h-3.5 w-3.5" /> },
                  { key: "dark", label: "Dark", icon: <Icon name="moon" className="h-3.5 w-3.5" /> },
                ]}
                value={theme}
                onChange={(v) => setTheme(v as any)}
              />
            </div>

            {/* Row: Language */}
            <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <Icon name="globe" className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Language</div>
                  <div className="text-[11px] text-neutral-400">Интерфейсийн хэл</div>
                </div>
              </div>
              <SegmentControl
                options={[
                  { key: "mn", label: "Монгол" },
                  { key: "en", label: "English" },
                ]}
                value={lang}
                onChange={(v) => setLang(v as any)}
              />
            </div>

            {/* Row: Text size */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <Icon name="text" className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-800">Text size</div>
                  <div className="text-[11px] text-neutral-400">Үсгийн хэмжээ</div>
                </div>
              </div>
              <SegmentControl
                options={[
                  { key: "normal", label: "Normal", icon: <span className="text-xs">Aa</span> },
                  { key: "large", label: "Large", icon: <span className="text-sm font-bold">Aa</span> },
                ]}
                value={textSize}
                onChange={(v) => setTextSize(v as any)}
              />
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}