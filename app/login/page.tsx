"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type Mode = "login" | "register";

function safeCallbackUrl(raw: string | null) {
  const decoded = raw ? decodeURIComponent(raw) : "/";
  // loop хамгаалалт
  if (decoded.startsWith("/login")) return "/";
  if (decoded.startsWith("/register")) return "/";
  if (decoded.startsWith("/reset-password")) return "/";
  return decoded || "/";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    return safeCallbackUrl(searchParams?.get("callbackUrl"));
  }, [searchParams]);

  // ✅ зөвхөн callbackUrl-г л дамжуулна (урт qs үүсгэхгүй)
  const callbackQS = useMemo(() => {
    return `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }, [callbackUrl]);

  const initialMode: Mode = useMemo(() => {
    const m = searchParams?.get("mode");
    return m === "register" ? "register" : "login";
  }, [searchParams]);

  const [mode, setMode] = useState<Mode>(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  // ✅ баталгаажуулах мэйл дахин явуулах UI
  const [needsVerify, setNeedsVerify] = useState(false);

  const hardRedirectFallback = () => {
    window.setTimeout(() => {
      if (window.location.pathname.startsWith("/login")) {
        window.location.href = callbackUrl;
      }
    }, 300);
  };

  const resendVerification = async () => {
    if (loading) return;
    setErr("");
    setOk("");
    setLoading(true);

    try {
      // ✅ resend хийхийн тулд түр signIn хийнэ
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (cred.user.emailVerified) {
        setNeedsVerify(false);
        setOk("Имэйл аль хэдийн баталгаажсан байна. Одоо нэвтэрч болно.");
        router.replace(callbackUrl);
        router.refresh();
        hardRedirectFallback();
        return;
      }

      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });

      // ✅ resend хийсний дараа signOut хийнэ
      await signOut(auth);

      setNeedsVerify(true);
      setOk("Баталгаажуулах мэйл дахин явууллаа. Gmail-ээ шалгаарай.");
    } catch (error: any) {
      const code = error?.code as string | undefined;

      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setErr("Имэйл эсвэл нууц үг буруу байна.");
      } else if (code === "auth/user-not-found") {
        setErr("Энэ имэйлээр бүртгэл олдсонгүй.");
      } else if (code === "auth/invalid-email") {
        setErr("Имэйл хаяг буруу форматтай байна.");
      } else if (code === "auth/too-many-requests") {
        setErr("Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоорой.");
      } else {
        setErr("Алдаа гарлаа. Дахин оролдоорой.");
      }

      console.error("resend verification error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setOk("");
    setNeedsVerify(false);
    setLoading(true);

    // ✅ Register үед "нууц үг давтах" шалгана
    if (mode === "register") {
      if (password !== confirmPassword) {
        setErr("Нууц үг таарахгүй байна. Дахин шалгана уу.");
        setLoading(false);
        return;
      }
    }

    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

        // ✅ Email баталгаажаагүй бол нэвтрүүлэхгүй
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setNeedsVerify(true);
          setErr("Имэйл баталгаажуулаагүй байна. Gmail-ээ шалгаад баталгаажуулна уу.");
          return;
        }

        setOk("Амжилттай нэвтэрлээ.");

        router.replace(callbackUrl);
        router.refresh();
        hardRedirectFallback();
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

        // ✅ Баталгаажуулах мэйл явуулна
        await sendEmailVerification(cred.user, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        });

        // ✅ Шууд нэвтрүүлэхгүй — signOut
        await signOut(auth);

        setNeedsVerify(true);
        setOk("Бүртгэл амжилттай. Gmail-ээ шалгаад баталгаажуулсны дараа нэвтэрнэ үү.");
      }
    } catch (error: any) {
      const code = error?.code as string | undefined;

      if (mode === "login") {
        if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
          setErr("Имэйл эсвэл нууц үг буруу байна.");
        } else if (code === "auth/user-not-found") {
          setErr("Энэ имэйлээр бүртгэл олдсонгүй.");
        } else if (code === "auth/invalid-email") {
          setErr("Имэйл хаяг буруу форматтай байна.");
        } else if (code === "auth/too-many-requests") {
          setErr("Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоорой.");
        } else {
          setErr("Нэвтрэхэд алдаа гарлаа. Дахин оролдоорой.");
        }
      } else {
        if (code === "auth/email-already-in-use") {
          setErr("Энэ имэйл өмнө нь бүртгэлтэй байна. Нэвтрэх таб руу ороод орно уу.");
        } else if (code === "auth/invalid-email") {
          setErr("Имэйл хаяг буруу форматтай байна.");
        } else if (code === "auth/weak-password") {
          setErr("Нууц үг сул байна. Дор хаяж 6 тэмдэгт байлгаарай.");
        } else if (code === "auth/too-many-requests") {
          setErr("Олон удаа оролдлоо. Түр хүлээнэ үү.");
        } else {
          setErr("Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоорой.");
        }
      }

      console.error("auth error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full">
      <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full items-center justify-center px-4 py-10">
        <div
          className="
            w-[520px] max-w-[92vw]
            rounded-[24px]
            border-4 border-sky-500/40
shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_20px_80px_rgba(0,120,255,0.15)]
            bg-white/[0.04]
            shadow-[0_20px_80px_rgba(0,0,0,0.55)]
            backdrop-blur
            overflow-hidden
          "
        >
          {/* Top */}
          <div className="px-8 pt-8 pb-6 border-b border-white/10">
            {/* ✅ Brand хэсгийг цэвэрлэсэн (MASTER AI, платформ, робот байхгүй) */}
            <div className="mx-auto mb-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 font-bold">
                  M
                </div>
              </div>
              <div />
            </div>

            {/* ✅ Зөвхөн НЭВТРЭХ / БҮРТГҮҮЛЭХ */}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode("login");
                  setErr("");
                  setOk("");
                  setNeedsVerify(false);
                  setConfirmPassword("");
                }}
                className={[
                  "h-11 rounded-xl border px-3 text-sm font-semibold transition",
                  loading ? "opacity-60 cursor-not-allowed" : "",
                  mode === "login"
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                ].join(" ")}
              >
                НЭВТРЭХ
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode("register");
                  setErr("");
                  setOk("");
                  setNeedsVerify(false);
                  setConfirmPassword("");
                }}
                className={[
                  "h-11 rounded-xl border px-3 text-sm font-semibold transition",
                  loading ? "opacity-60 cursor-not-allowed" : "",
                  mode === "register"
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                ].join(" ")}
              >
                БҮРТГҮҮЛЭХ
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-7">
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-2 block text-xs text-white/60">И-мэйл хаяг</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="
                    w-full h-12 rounded-xl
                    border border-white/10
                    bg-white/5
                    px-4
                    text-sm text-white
                    outline-none transition
                    focus:border-white/20 focus:bg-white/10
                  "
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-xs text-white/60">Нууц үг</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="
                    w-full h-12 rounded-xl
                    border border-white/10
                    bg-white/5
                    px-4
                    text-sm text-white
                    outline-none transition
                    focus:border-white/20 focus:bg-white/10
                  "
                />

                {/* Login үед л reset link үлдээнэ */}
                {mode === "login" && (
                  <div className="mt-3 text-xs">
                    <Link
                      href={`/reset-password${callbackQS}`}
                      className="text-white/55 hover:text-white"
                    >
                      Нууц үг сэргээх
                    </Link>
                  </div>
                )}
              </div>

              {/* Confirm password (REGISTER ONLY) */}
              {mode === "register" && (
                <div>
                  <label className="mb-2 block text-xs text-white/60">Нууц үг давтах</label>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    className="
                      w-full h-12 rounded-xl
                      border border-white/10
                      bg-white/5
                      px-4
                      text-sm text-white
                      outline-none transition
                      focus:border-white/20 focus:bg-white/10
                    "
                  />
                </div>
              )}

              {/* Error / Success */}
              {err && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {err}
                </div>
              )}
              {ok && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {ok}
                </div>
              )}

              {/* Verify resend (логик хэвээр) */}
              {needsVerify && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={resendVerification}
                  className="
                    w-full h-12 rounded-xl
                    border border-white/15 bg-white/5
                    text-sm font-semibold text-white
                    hover:bg-white/10
                    disabled:opacity-60
                  "
                >
                  Баталгаажуулах мэйл дахин явуулах
                </button>
              )}

              <button
                disabled={loading}
                type="submit"
                className="
                  w-full h-12 rounded-xl
                  bg-gradient-to-r from-sky-500 to-blue-600
                  text-white text-sm font-bold tracking-wide
                  shadow-[0_14px_60px_rgba(0,120,255,0.25)]
                  hover:brightness-110
                  disabled:opacity-60
                  transition
                "
              >
                {loading ? "Түр хүлээнэ үү..." : mode === "login" ? "НЭВТРЭХ" : "БҮРТГҮҮЛЭХ"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-7">
            <div className="h-px w-full bg-white/10 mb-4" />
            <p className="mx-auto max-w-[360px] text-center text-[11px] leading-snug text-white/40">
              Онлайн хичээл • ebacreator платформ
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
