// app/reset-password/ResetPasswordClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

function safeCallbackUrl(raw: string | null) {
  const decoded = raw ? decodeURIComponent(raw) : "/";
  if (decoded.startsWith("/login")) return "/";
  if (decoded.startsWith("/register")) return "/";
  if (decoded.startsWith("/reset-password")) return "/";
  return decoded || "/";
}

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    return safeCallbackUrl(searchParams?.get("callbackUrl"));
  }, [searchParams]);

  const callbackQS = useMemo(() => {
    return `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }, [callbackUrl]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setOk("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setOk("Сэргээх холбоосыг имэйл рүү чинь явууллаа. Inbox/Spam-аа шалгаарай.");
    } catch (error: any) {
      const code = error?.code as string | undefined;

      if (code === "auth/invalid-email") setErr("Имэйл хаяг буруу форматтай байна.");
      else if (code === "auth/user-not-found") setErr("Энэ имэйлээр бүртгэл олдсонгүй.");
      else if (code === "auth/too-many-requests")
        setErr("Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоорой.");
      else setErr("Сэргээх хүсэлт явуулахад алдаа гарлаа. Дахин оролдоорой.");

      console.error("reset password error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Чиний JSX яг хэвээрээ энд байна (copy-paste)
    <main className="w-full">
      {/* ...таны UI... */}
    </main>
  );
}
