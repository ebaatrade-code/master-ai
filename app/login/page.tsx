"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAuthForm,
  strengthBarColors,
  strengthLabels,
  strengthTextColors,
} from "@/hooks/useAuthForm";

function safeCallbackUrl(raw: string | null) {
  const decoded = raw ? decodeURIComponent(raw) : "/";
  if (decoded.startsWith("/login")) return "/";
  if (decoded.startsWith("/register")) return "/";
  if (decoded.startsWith("/reset-password")) return "/";
  return decoded || "/";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => safeCallbackUrl(searchParams?.get("callbackUrl")), [searchParams]);
  const callbackQS = useMemo(() => `?callbackUrl=${encodeURIComponent(callbackUrl)}`, [callbackUrl]);
  const initialMode = useMemo(() => {
    const m = searchParams?.get("mode");
    return m === "register" ? "register" as const : "login" as const;
  }, [searchParams]);

  const f = useAuthForm({
    initialMode,
    callbackUrl,
    onSuccess: () => {
      router.replace(callbackUrl);
      router.refresh();
    },
  });

  const inputCls =
    "w-full h-12 rounded-2xl bg-white !bg-white px-4 text-sm text-black outline-none transition " +
    "border border-black focus:border-black";

  return (
    <main className="w-full bg-white">
      <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full items-center justify-center px-4 py-10">
        <div className="w-[520px] max-w-[92vw] rounded-[24px] bg-white overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_24px_90px_rgba(0,0,0,0.16)]">
          {/* Header */}
          <div className="px-8 pt-10 pb-6">
            <div className="text-center">
              <div className="text-[20px] font-extrabold text-black">Welcome to Master AI</div>
              <div className="mt-2 text-[12px] text-black/60 leading-relaxed">
                И-мэйл хаяг болон нууц үгээр нэвтэрч орно уу.
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <form onSubmit={f.onSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="mb-2 block text-xs text-black/70">И-мэйл хаяг</label>
                <input
                  id="login-email"
                  name="email"
                  value={f.email}
                  onChange={(e) => f.setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="И-мэйл хаяг"
                  className={inputCls}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="mb-2 block text-xs text-black/70">Нууц үг</label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    value={f.password}
                    onChange={(e) => f.setPassword(e.target.value)}
                    type={f.showPassword ? "text" : "password"}
                    autoComplete={f.mode === "login" ? "current-password" : "new-password"}
                    placeholder="Нууц үг"
                    className={inputCls + " pr-12"}
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

                {/* Password strength (register only) */}
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
                    <Link href={`/reset-password${callbackQS}`} className="text-black/70 hover:text-black">Нууц үг сэргээх</Link>
                  </div>
                )}
              </div>

              {/* Confirm password (register) */}
              {f.mode === "register" && (
                <div>
                  <label className="mb-2 block text-xs text-black/70">Нууц үг давтах</label>
                  <div className="relative">
                    <input
                      value={f.confirmPassword}
                      onChange={(e) => f.setConfirmPassword(e.target.value)}
                      type={f.showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      className={inputCls + " pr-12"}
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
                <div className="rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{f.err}</div>
              )}
              {f.ok && (
                <div className="rounded-2xl border-2 border-black bg-white px-3 py-2 text-xs text-black">{f.ok}</div>
              )}

              {/* Rate limit warning */}
              {f.locked && (
                <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                  🔒 Хэт олон оролдлого. {f.remainingSeconds()} секунд хүлээнэ үү.
                </div>
              )}

              {/* Verify resend */}
              {f.needsVerify && (
                <button type="button" disabled={f.loading} onClick={f.resendVerification} className="w-full h-12 rounded-2xl border-2 border-black bg-white text-sm font-bold text-black hover:bg-black/[0.03] disabled:opacity-60 transition">
                  Баталгаажуулах мэйл дахин явуулах
                </button>
              )}

              {/* Buttons */}
              <div className="pt-2 space-y-3">
                <button
                  disabled={f.loading || f.locked}
                  type="submit"
                  className={[
                    "w-full h-12 rounded-full text-sm font-extrabold tracking-wide transition",
                    f.loading || f.locked ? "opacity-60" : "",
                    f.mode === "login"
                      ? "bg-gradient-to-r from-sky-400 to-blue-400 text-black shadow-[0_14px_60px_rgba(0,120,255,0.25)]"
                      : "bg-gradient-to-r from-green-300 to-emerald-300 text-black shadow-[0_14px_60px_rgba(255,140,0,0.25)]",
                  ].join(" ")}
                >
                  {f.loading ? "Түр хүлээнэ үү..." : f.mode === "login" ? "НЭВТРЭХ" : "БҮРТГҮҮЛЭХ"}
                </button>

                <button
                  type="button"
                  disabled={f.loading}
                  onClick={f.switchMode}
                  className={["w-full h-12 rounded-full border border-black bg-white text-sm font-extrabold transition", f.loading ? "opacity-60" : "", "text-black opacity-20 hover:opacity-40"].join(" ")}
                >
                  {f.mode === "login" ? "БҮРТГҮҮЛЭХ" : "НЭВТРЭХ"}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8">
            <div className="h-px w-full bg-black/10 mb-4" />
            <p className="mx-auto max-w-[360px] text-center text-[11px] leading-snug text-black/55">Онлайн хичээл • ebacreator платформ</p>
          </div>
        </div>
      </div>
    </main>
  );
}