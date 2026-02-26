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

export default function ResetPasswordPage() {
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
    <main className="min-h-[100vh] w-full flex items-center justify-center px-4">
      <div
        className="
          w-[440px] max-w-[92vw]
          rounded-2xl
          border border-black/10
          bg-white
          shadow-[0_20px_80px_rgba(0,0,0,0.18)]
          overflow-hidden
        "
      >
        <div className="px-8 pt-8 pb-5 border-b border-black/10">
        
          <h1 className="text-center text-lg font-extrabold text-black">
            Нууц үг сэргээх
          </h1>
          <p className="mt-1 text-center text-xs text-black/55">
            Бүртгэлтэй имэйлээ оруулаарай. Сэргээх холбоос очно.
          </p>
        </div>

        <div className="px-8 py-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-black">
                Имэйл хаяг
              </label>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="name@gmail.com"
                className="
                  w-full
                  rounded-xl
                  border border-black
                  bg-white
                  px-4 py-3
                  text-sm text-black
                  outline-none
                  focus:ring-0
                  focus:border-black
                "
              />
            </div>

            {err && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                {err}
              </div>
            )}

            {ok && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                {ok}
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="
                w-full rounded-xl
                bg-blue-500 text-white
                py-3 text-sm font-extrabold
                hover:opacity-95
                disabled:opacity-60
                transition
              "
            >
              {loading ? "Түр хүлээнэ үү..." : "Сэргээх холбоос явуулах →"}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs text-black/60">
              <Link href={`/login${callbackQS}`} className="hover:text-black">
                 Нэвтрэх рүү буцах
              </Link>

            </div>
          </form>
        </div>

        <div className="px-8 pb-7">
          <div className="h-px w-full bg-black/10 mb-4" />
          <p className="text-center text-[11px] text-black/45">
            Онлайн хичээлд хөрвүүлэгч • ebacreator платформ
          </p>
        </div>
      </div>
    </main>
  );
}