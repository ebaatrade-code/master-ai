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

// ---------- tiny icons (inline SVG) ----------
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
    | "check";
  className?: string;
}) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
  }
}

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
        "group w-full rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-white/25 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          : "border-white/10 bg-black/40 hover:bg-black/55 hover:border-white/15"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-2xl border",
            active ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5"
          )}
        >
          <span className="text-white/90">{leftIcon}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-extrabold text-white">{title}</div>
            {active && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/85">
                <Icon name="check" className="h-3.5 w-3.5" />
                Сонгосон
              </span>
            )}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-white/60">{subtitle}</div>}
        </div>
      </div>
    </button>
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
    showToast("ok", "Тохиргоо хадгалагдлаа ✅");
  };

  // ---- Security actions ----
  const email = useMemo(() => user?.email || userDoc?.email || "", [user?.email, userDoc?.email]);
  const lastLoginText = useMemo(() => formatDateTime(user?.metadata?.lastSignInTime || ""), [user?.metadata?.lastSignInTime]);

  const canChangePassword = userDoc?.authMethod === "email"; // email/password үед

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const sendReset = async () => {
    if (!email) return showToast("err", "Email олдсонгүй.");
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("ok", "Reset email илгээлээ ✅ (Inbox/Spam шалгаарай)");
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
    if (pw1.trim().length < 6) return showToast("err", "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна.");
    if (pw1 !== pw2) return showToast("err", "Нууц үг таарахгүй байна.");

    setPwSaving(true);
    try {
      await updatePassword(user, pw1);
      setPw1("");
      setPw2("");
      showToast("ok", "Нууц үг амжилттай солигдлоо ✅");
    } catch (e: any) {
      console.error(e);
      // Firebase: "auth/requires-recent-login" хамгийн түгээмэл
      if (String(e?.code || "").includes("requires-recent-login")) {
        showToast("err", "Сүүлд нэвтэрсэн баталгаажуулалт хэрэгтэй. Reset email илгээж сольж болно.");
      } else {
        showToast("err", e?.message || "Нууц үг солих алдаа");
      }
    } finally {
      setPwSaving(false);
    }
  };

  // ---- UI classes (Profile-тэй адил цэвэрхэн) ----
  const pageWrap = "min-h-screen bg-black text-white";
  const container = "mx-auto max-w-5xl px-5 py-10";
  const sectionCls = "border-t border-white/10 pt-8 mt-8";
  const panel = "rounded-3xl border border-white/10 bg-black/75 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.55)]";
  const panelPad = "p-6";
  const input =
    "w-full rounded-2xl border border-white/12 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25 focus:bg-black/70";
  const label = "text-sm font-extrabold text-white/90";
  const hint = "text-xs text-white/55";

  return (
    <div className={pageWrap}>
      <div className={container}>
        {/* Title */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Тохиргоо</h1>
            <p className="mt-2 text-sm text-white/60">
              Аюулгүй байдал • Харагдац • Хэл • Хэмжээ
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/profile" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Profile
            </Link>
            <Link href="/progress" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Progress
            </Link>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "mt-6 rounded-2xl border px-4 py-3 text-sm",
              toast.type === "ok" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-50",
              toast.type === "err" && "border-red-400/30 bg-red-400/10 text-red-50",
              toast.type === "info" && "border-white/15 bg-white/5 text-white/80"
            )}
          >
            <span className="font-semibold">{toast.text}</span>
          </div>
        )}

        {/* A) Account & Security */}
        <section className={sectionCls}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white/50">A) ACCOUNT & SECURITY (заавал)</div>
              <div className="mt-1 text-xl font-extrabold">Аюулгүй байдал</div>
              <div className="mt-1 text-sm text-white/60">
                Нууц үг сэргээх, солих, сүүлд нэвтэрсэн мэдээлэл.
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
              <Icon name="clock" className="h-4 w-4" />
              <span className="font-semibold">Сүүлд:</span>
              <span className="text-white/90">{lastLoginText}</span>
            </div>
          </div>

          <div className={cn("mt-5", panel, panelPad)}>
            <div className="grid gap-5 md:grid-cols-2">
              {/* Reset email */}
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon name="mail" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">Нууц үг сэргээх</div>
                    <div className="text-xs text-white/60 truncate">
                      Reset холбоос <span className="text-white/85 font-semibold">{email || "—"}</span> руу очно.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={sendReset}
                  disabled={resetSending || !email}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold hover:bg-white/15 disabled:opacity-60"
                >
                  <Icon name="mail" className="h-4 w-4" />
                  {resetSending ? "Илгээж байна..." : "Reset email илгээх"}
                </button>

                <div className="mt-3 text-xs text-white/55">
                  Inbox дээр харагдахгүй бол Spam/Promotions-оо шалгаарай.
                </div>
              </div>

              {/* Change password */}
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon name="key" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold">Нууц үг солих</div>
                    <div className="text-xs text-white/60">
                      {canChangePassword ? "Email/Password хэрэглэгчид" : "Google хэрэглэгчид (унтраалттай)"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <div className={label}>Шинэ нууц үг</div>
                    <input
                      className={cn(input, !canChangePassword && "opacity-60 cursor-not-allowed")}
                      disabled={!canChangePassword}
                      value={pw1}
                      onChange={(e) => setPw1(e.target.value)}
                      placeholder="Шинэ нууц үг (min 6)"
                      type="password"
                    />
                  </div>

                  <div>
                    <div className={label}>Шинэ нууц үг (дахин)</div>
                    <input
                      className={cn(input, !canChangePassword && "opacity-60 cursor-not-allowed")}
                      disabled={!canChangePassword}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="Дахин бич"
                      type="password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={changePassword}
                    disabled={!canChangePassword || pwSaving}
                    className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-black hover:opacity-90 disabled:opacity-60"
                  >
                    <Icon name="key" className="h-4 w-4" />
                    {pwSaving ? "Сольж байна..." : "Нууц үг солих"}
                  </button>

                  <div className={hint}>
                    * Заримдаа Firebase “recent login” шаардана. Тэгвэл дээрх Reset email-ээр хамгийн амархан сольдог.
                  </div>
                </div>
              </div>
            </div>

            {/* last login (mobile) */}
            <div className="mt-5 sm:hidden rounded-2xl border border-white/10 bg-black/55 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Icon name="clock" />
                <span className="font-extrabold">Сүүлд нэвтэрсэн:</span>
                <span className="text-white/90">{lastLoginText}</span>
              </div>
            </div>
          </div>
        </section>

        {/* B) Preferences */}
        <section className={sectionCls}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white/50">B) PREFERENCES (UX-д заавал)</div>
              <div className="mt-1 text-xl font-extrabold">Харагдац & Хэл</div>
              <div className="mt-1 text-sm text-white/60">
                Өдөр/шөнө хамаагүй тухтай үзэх тохиргоо. (localStorage)
              </div>
            </div>

            <button
              type="button"
              onClick={savePrefs}
              className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-black hover:opacity-90"
            >
              Хадгалах
            </button>
          </div>

          <div className={cn("mt-5", panel, panelPad)}>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Theme */}
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon name="palette" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold">Theme</div>
                    <div className="text-xs text-white/60">Dark / Light</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Pill
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    leftIcon={<Icon name="moon" />}
                    title="Dark"
                    subtitle="Нүдэнд амар"
                  />
                  <Pill
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    leftIcon={<Icon name="sun" />}
                    title="Light"
                    subtitle="Гэгээлэг харагдац"
                  />
                </div>

                <div className="mt-3 text-xs text-white/55">
                  * Одоогоор хадгалаад дараа нь бүх сайтад нэг дор хэрэгжүүлнэ.
                </div>
              </div>

              {/* Language */}
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon name="globe" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold">Language</div>
                    <div className="text-xs text-white/60">MN / EN</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Pill
                    active={lang === "mn"}
                    onClick={() => setLang("mn")}
                    leftIcon={<span className="text-sm font-extrabold">MN</span>}
                    title="Монгол"
                    subtitle="mn-MN"
                  />
                  <Pill
                    active={lang === "en"}
                    onClick={() => setLang("en")}
                    leftIcon={<span className="text-sm font-extrabold">EN</span>}
                    title="English"
                    subtitle="en-US"
                  />
                </div>

                <div className="mt-3 text-xs text-white/55">
                  * Хүсвэл дараа нь Firestore-т sync хийж болно (optional).
                </div>
              </div>

              {/* Text size */}
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon name="text" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold">Text size</div>
                    <div className="text-xs text-white/60">Normal / Large</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Pill
                    active={textSize === "normal"}
                    onClick={() => setTextSize("normal")}
                    leftIcon={<span className="text-sm font-extrabold">Aa</span>}
                    title="Normal"
                    subtitle="Стандарт хэмжээ"
                  />
                  <Pill
                    active={textSize === "large"}
                    onClick={() => setTextSize("large")}
                    leftIcon={<span className="text-sm font-extrabold">AA</span>}
                    title="Large"
                    subtitle="Хараанд эвтэй"
                  />
                </div>

                <div className="mt-3 text-xs text-white/55">
                  * Accessibility-д хэрэгтэй.
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="flex items-center gap-2">
                <Icon name="shield" className="h-4 w-4" />
                <span className="font-extrabold">Санамж:</span>
                <span className="text-white/80">
                  Theme/Language/Text size тохиргоо localStorage-д хадгалагдана.
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="h-10" />
      </div>
    </div>
  );
}
