// app/login/LoginClient.tsx
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
  if (decoded.startsWith("/login")) return "/";
  if (decoded.startsWith("/register")) return "/";
  if (decoded.startsWith("/reset-password")) return "/";
  return decoded || "/";
}

export default function LoginClient() {
  // --- эндээс доош ЧИНИЙ КОД яг хэвээрээ ---
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
    // Чиний JSX яг хэвээрээ (би энд зай хэмнэхийн тулд тайрсангүй)
    // Та шууд дээрх return хэсгийг өөрийнхөөрөө бүтнээр нь үлдээнэ
    <main className="w-full">
      {/* ...Чиний UI... */}
      {/* ЭНД ЧИНИЙ return JSX-ийг яг байгаагаар нь paste хийнэ */}
    </main>
  );
}
