"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type Mode = "login" | "register";

export default function LoginSheet({
  callbackUrl,
  initialMode = "login",
  onClose,
}: {
  callbackUrl: string;
  initialMode?: Mode;
  onClose?: () => void;
}) {
  const router = useRouter();

  const callbackQS = useMemo(() => {
    return `?callbackUrl=${encodeURIComponent(callbackUrl || "/")}`;
  }, [callbackUrl]);

  const [mode, setMode] = useState<Mode>(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  // ✅ баталгаажуулах мэйл дахин явуулах UI
  const [needsVerify, setNeedsVerify] = useState(false);

  // ✅ Drawer дээр ESC дархад хаах боломжтой
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hardRedirectFallback = () => {
    window.setTimeout(() => {
      try {
        window.location.href = callbackUrl || "/";
      } catch {}
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
        onClose?.();
        router.replace(callbackUrl || "/");
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

        onClose?.();
        router.replace(callbackUrl || "/");
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
    <div className="w-full max-w-[420px]">
      {/* Title */}
      <div className="text-center">
        <div className="text-[28px] font-extrabold tracking-tight text-black">
          {mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </div>
        <div className="mt-2 text-sm text-black/45 leading-snug">
          Имэйл хаяг болон нууц үгээ хийгээд нэвтэрч орно уу.
        </div>
      </div>

      {/* Tabs (login/register) — zadlan шиг pill */}
      <div className="mt-6">
        <div className="mx-auto flex w-full max-w-[360px] rounded-full border border-black/10 bg-black/[0.03] p-1">
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
              "h-10 flex-1 rounded-full text-sm font-extrabold transition",
              loading ? "opacity-60 cursor-not-allowed" : "",
              mode === "login"
                ? "bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                : "text-black/55 hover:text-black",
            ].join(" ")}
          >
            Нэвтрэх
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
              "h-10 flex-1 rounded-full text-sm font-extrabold transition",
              loading ? "opacity-60 cursor-not-allowed" : "",
              mode === "register"
                ? "bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                : "text-black/55 hover:text-black",
            ].join(" ")}
          >
            Бүртгүүлэх
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="mt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-black/60">
              Имэйл хаяг
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="
                w-full h-12 rounded-xl
                border border-black/10
                bg-white
                px-4
                text-sm text-black
                outline-none transition
                focus:border-black/25
              "
              placeholder=""
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-black/60">
              Нууц үг
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="
                w-full h-12 rounded-xl
                border border-black/10
                bg-white
                px-4
                text-sm text-black
                outline-none transition
                focus:border-black/25
              "
              placeholder=""
            />

            {mode === "login" && (
              <div className="mt-3 text-xs">
                <Link
                  href={`/reset-password${callbackQS}`}
                  className="text-black/45 hover:text-black"
                >
                  Нууц үг сэргээх
                </Link>
              </div>
            )}
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-2 block text-xs font-semibold text-black/60">
                Нууц үг давтах
              </label>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="
                  w-full h-12 rounded-xl
                  border border-black/10
                  bg-white
                  px-4
                  text-sm text-black
                  outline-none transition
                  focus:border-black/25
                "
                placeholder=""
              />
            </div>
          )}

          {err && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {err}
            </div>
          )}
          {ok && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
              {ok}
            </div>
          )}

          {needsVerify && (
            <button
              type="button"
              disabled={loading}
              onClick={resendVerification}
              className="
                w-full h-12 rounded-xl
                border border-black/10 bg-white
                text-sm font-extrabold text-black
                hover:bg-black/[0.03]
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
             bg-blue-400
              text-black text-sm font-extrabold
              shadow-[0_14px_60px_rgba(47,102,255,0.22)]
              hover:brightness-105
              disabled:opacity-60
              transition
              flex items-center justify-center gap-2
            "
          >
            <span>{loading ? "Түр хүлээнэ үү..." : "Үргэлжлүүлэх"}</span>
            <span aria-hidden="true" className="text-lg leading-none">
              
            </span>
          </button>
        </form>

        <div className="mt-8 border-t border-black/10 pt-4">
          <p className="text-center text-[11px] leading-snug text-black/35">
            Онлайн хичээл • ebacreator платформ
          </p>
        </div>
      </div>
    </div>
  );
}