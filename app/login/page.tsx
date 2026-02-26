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

        await sendEmailVerification(cred.user, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        });

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
          setErr("Энэ имэйл өмнө нь бүртгэлтэй байна. Нэвтрэх рүү орж нэвтэрнэ үү.");
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

  const inputCls =
  "w-full h-12 rounded-2xl bg-white !bg-white px-4 text-sm text-black outline-none transition " +
  "border border-black focus:border-black";

  return (
    <main className="w-full bg-white">
      <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full items-center justify-center px-4 py-10">
        <div
          className="
            w-[520px] max-w-[92vw]
            rounded-[24px]
            bg-white
            overflow-hidden
            shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_24px_90px_rgba(0,0,0,0.16)]
          "
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6">
            <div className="text-center">
              <div className="text-[20px] font-extrabold text-black">
                Welcome to Master AI
              </div>
              <div className="mt-2 text-[12px] text-black/60 leading-relaxed">
                И-мэйл хаяг болон нууц үгээр нэвтэрч орно уу.
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-2 block text-xs text-black/70">И-мэйл хаяг</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-xs text-black/70">Нууц үг</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={inputCls}
                />

                {mode === "login" && (
                  <div className="mt-3 text-xs">
                    <Link href={`/reset-password${callbackQS}`} className="text-black/70 hover:text-black">
                      Нууц үг сэргээх
                    </Link>
                  </div>
                )}
              </div>

              {/* Confirm password (REGISTER ONLY) */}
              {mode === "register" && (
                <div>
                  <label className="mb-2 block text-xs text-black/70">Нууц үг давтах</label>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>
              )}

              {/* Error / Success */}
             {err && (
  <div
    className="
      rounded-xl
      border border-red-500
      bg-red-50
      px-4 py-3
      text-sm font-medium
      text-red-600
    "
  >
    {err}
  </div>
)}
              {ok && (
                <div className="rounded-2xl border-2 border-black bg-white px-3 py-2 text-xs text-black">
                  {ok}
                </div>
              )}

              {/* Verify resend */}
              {needsVerify && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={resendVerification}
                  className="
                    w-full h-12 rounded-2xl
                    border-2 border-black bg-white
                    text-sm font-bold text-black
                    hover:bg-black/[0.03]
                    disabled:opacity-60
                    transition
                  "
                >
                  Баталгаажуулах мэйл дахин явуулах
                </button>
              )}

             {/* Buttons */}
<div className="pt-2 space-y-3">

  {/* PRIMARY */}
  <button
    disabled={loading}
    type="submit"
    className={[
      "w-full h-12 rounded-full text-sm font-extrabold tracking-wide transition",
      loading ? "opacity-60" : "",
      mode === "login"
        ? "bg-gradient-to-r from-sky-400 to-blue-400 text-black shadow-[0_14px_60px_rgba(0,120,255,0.25)]"
        : "bg-gradient-to-r from-green-300 to-emerald-300 text-black shadow-[0_14px_60px_rgba(255,140,0,0.25)]",
    ].join(" ")}
  >
    {loading
      ? "Түр хүлээнэ үү..."
      : mode === "login"
      ? "НЭВТРЭХ"
      : "БҮРТГҮҮЛЭХ"}
  </button>

  {/* SECONDARY */}
  <button
    type="button"
    disabled={loading}
    onClick={() => {
      setMode((m) => (m === "login" ? "register" : "login"));
      setErr("");
      setOk("");
      setNeedsVerify(false);
      setConfirmPassword("");
    }}
    className={[
      "w-full h-12 rounded-full border border-black bg-white text-sm font-extrabold transition",
      loading ? "opacity-60" : "",
      "text-black opacity-20 hover:opacity-40",
    ].join(" ")}
  >
    {mode === "login" ? "БҮРТГҮҮЛЭХ" : "НЭВТРЭХ"}
  </button>
</div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8">
            <div className="h-px w-full bg-black/10 mb-4" />
            <p className="mx-auto max-w-[360px] text-center text-[11px] leading-snug text-black/55">
              Онлайн хичээл • ebacreator платформ
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}