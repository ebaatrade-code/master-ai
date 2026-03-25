"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAuthForm,
  strengthBarColors,
  strengthLabels,
  strengthTextColors,
} from "@/hooks/useAuthForm";

export default function LoginSheet({
  callbackUrl,
  initialMode = "login",
  onClose,
}: {
  callbackUrl: string;
  initialMode?: "login" | "register";
  onClose?: () => void;
}) {
  const router = useRouter();

  const callbackQS = useMemo(() => {
    return `?callbackUrl=${encodeURIComponent(callbackUrl || "/")}`;
  }, [callbackUrl]);

  const f = useAuthForm({
    initialMode,
    callbackUrl: callbackUrl || "/",
    onSuccess: () => {
      onClose?.();
      router.replace(callbackUrl || "/");
      router.refresh();
    },
  });

  // ESC хаах
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="w-full max-w-[420px]">
      {/* Title */}
      <div className="text-center">
        <div className="text-[28px] font-extrabold tracking-tight text-black">
          {f.mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </div>
        <div className="mt-2 text-sm text-black/45 leading-snug">
          Имэйл хаяг болон нууц үгээ хийгээд нэвтэрч орно уу.
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div className="mx-auto flex w-full max-w-[360px] rounded-full border border-black/10 bg-black/[0.03] p-1">
          <button
            type="button"
            disabled={f.loading}
            onClick={() => f.mode !== "login" && f.switchMode()}
            className={[
              "h-10 flex-1 rounded-full text-sm font-extrabold transition",
              f.loading ? "opacity-60 cursor-not-allowed" : "",
              f.mode === "login"
                ? "bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                : "text-black/55 hover:text-black",
            ].join(" ")}
          >
            Нэвтрэх
          </button>
          <button
            type="button"
            disabled={f.loading}
            onClick={() => f.mode !== "register" && f.switchMode()}
            className={[
              "h-10 flex-1 rounded-full text-sm font-extrabold transition",
              f.loading ? "opacity-60 cursor-not-allowed" : "",
              f.mode === "register"
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
        <form onSubmit={f.onSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-black/60">Имэйл хаяг</label>
            <input
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="w-full h-12 rounded-xl border border-black/10 bg-white px-4 text-sm text-black outline-none transition focus:border-black/25"
              placeholder=""
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-black/60">Нууц үг</label>
            <div className="relative">
              <input
                value={f.password}
                onChange={(e) => f.setPassword(e.target.value)}
                type={f.showPassword ? "text" : "password"}
                autoComplete={f.mode === "login" ? "current-password" : "new-password"}
                className="w-full h-12 rounded-xl border border-black/10 bg-white px-4 pr-12 text-sm text-black outline-none transition focus:border-black/25"
                placeholder=""
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => f.setShowPassword(!f.showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black/60 transition"
              >
                {f.showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>

            {/* Password strength (register) */}
            {f.mode === "register" && f.password.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= f.strength.score ? strengthBarColors[f.strength.level] : "bg-black/10"}`} />
                    ))}
                  </div>
                  <span className={`text-[11px] font-bold ${strengthTextColors[f.strength.level]}`}>{strengthLabels[f.strength.level]}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  {f.strength.checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      {c.pass ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-black/15"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      <span className={`text-[11px] ${c.pass ? "text-black/70" : "text-black/30"}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {f.mode === "login" && (
              <div className="mt-3 text-xs">
                <Link href={`/reset-password${callbackQS}`} className="text-black/45 hover:text-black">Нууц үг сэргээх</Link>
              </div>
            )}
          </div>

          {/* Confirm password (register) */}
          {f.mode === "register" && (
            <div>
              <label className="mb-2 block text-xs font-semibold text-black/60">Нууц үг давтах</label>
              <div className="relative">
                <input
                  value={f.confirmPassword}
                  onChange={(e) => f.setConfirmPassword(e.target.value)}
                  type={f.showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full h-12 rounded-xl border border-black/10 bg-white px-4 pr-12 text-sm text-black outline-none transition focus:border-black/25"
                  placeholder=""
                />
                <button type="button" tabIndex={-1} onClick={() => f.setShowConfirm(!f.showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black/60 transition">
                  {f.showConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {f.confirmPassword && f.password !== f.confirmPassword && (
                <p className="mt-1.5 text-[11px] text-red-500">Нууц үг таарахгүй байна</p>
              )}
              {f.confirmPassword && f.password === f.confirmPassword && f.confirmPassword.length >= 6 && (
                <p className="mt-1.5 text-[11px] text-emerald-500">✓ Таарч байна</p>
              )}
            </div>
          )}

          {/* Error / Success */}
          {f.err && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700">{f.err}</div>
          )}
          {f.ok && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{f.ok}</div>
          )}

          {/* Rate limit warning */}
          {f.locked && (
            <div className="rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              🔒 {f.remainingSeconds()} секунд хүлээнэ үү.
            </div>
          )}

          {/* Verify resend */}
          {f.needsVerify && (
            <button type="button" disabled={f.loading} onClick={f.resendVerification} className="w-full h-12 rounded-xl border border-black/10 bg-white text-sm font-extrabold text-black hover:bg-black/[0.03] disabled:opacity-60">
              Баталгаажуулах мэйл дахин явуулах
            </button>
          )}

          {/* Submit */}
          <button
            disabled={f.loading || f.locked}
            type="submit"
            className="w-full h-12 rounded-xl bg-blue-400 text-black text-sm font-extrabold shadow-[0_14px_60px_rgba(47,102,255,0.22)] hover:brightness-105 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            <span>{f.loading ? "Түр хүлээнэ үү..." : "Үргэлжлүүлэх"}</span>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 border-t border-black/10 pt-4">
          <p className="text-center text-[11px] leading-snug text-black/35">Онлайн хичээл • ebacreator платформ</p>
        </div>
      </div>
    </div>
  );
}