import { useCallback, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export type AuthMode = "login" | "register";

/* ══════════════════════════════════════
   Rate Limiter
   ══════════════════════════════════════ */
const MAX_ATTEMPTS = 5;
const LOCKOUT_SEC = 30;
const MAX_ATTEMPTS_HARD = 10;
const LOCKOUT_SEC_HARD = 300;

/* ══════════════════════════════════════
   Password Strength
   ══════════════════════════════════════ */
export type StrengthLevel = "weak" | "fair" | "good" | "strong";

export type StrengthResult = {
  level: StrengthLevel;
  score: number;
  checks: { label: string; pass: boolean }[];
};

export function getPasswordStrength(pw: string): StrengthResult {
  const checks = [
    { label: "6+ тэмдэгт", pass: pw.length >= 6 },
    { label: "Том үсэг (A-Z)", pass: /[A-Z]/.test(pw) },
    { label: "Жижиг үсэг (a-z)", pass: /[a-z]/.test(pw) },
    { label: "Тоо (0-9)", pass: /[0-9]/.test(pw) },
    { label: "Тусгай тэмдэгт", pass: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.pass).length;
  let level: StrengthLevel = "weak";
  if (score >= 5) level = "strong";
  else if (score >= 4) level = "good";
  else if (score >= 3) level = "fair";
  return { level, score, checks };
}

export const strengthBarColors: Record<StrengthLevel, string> = {
  weak: "bg-red-400",
  fair: "bg-amber-400",
  good: "bg-blue-400",
  strong: "bg-emerald-400",
};
export const strengthLabels: Record<StrengthLevel, string> = {
  weak: "Сул",
  fair: "Дунд",
  good: "Сайн",
  strong: "Хүчтэй",
};
export const strengthTextColors: Record<StrengthLevel, string> = {
  weak: "text-red-500",
  fair: "text-amber-500",
  good: "text-blue-500",
  strong: "text-emerald-500",
};

/* ══════════════════════════════════════
   Safe error messages
   ══════════════════════════════════════ */
function getLoginError(code: string | undefined): string {
  if (code === "auth/too-many-requests") return "Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоорой.";
  return "Имэйл эсвэл нууц үг буруу байна.";
}

function getRegisterError(code: string | undefined): string {
  if (code === "auth/email-already-in-use") return "Энэ имэйл өмнө нь бүртгэлтэй байна. Нэвтрэх рүү орж нэвтэрнэ үү.";
  if (code === "auth/invalid-email") return "Имэйл хаяг буруу форматтай байна.";
  if (code === "auth/weak-password") return "Нууц үг сул байна. Дор хаяж 6 тэмдэгт байлгаарай.";
  if (code === "auth/too-many-requests") return "Олон удаа оролдлоо. Түр хүлээнэ үү.";
  return "Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоорой.";
}

/* ══════════════════════════════════════
   useAuthForm Hook
   ══════════════════════════════════════ */
export function useAuthForm(opts: {
  initialMode?: AuthMode;
  callbackUrl: string;
  onSuccess?: () => void;
}) {
  const { callbackUrl, onSuccess } = opts;

  const [mode, setMode] = useState<AuthMode>(opts.initialMode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);

  // Rate limiter state
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const isLocked = useCallback(() => {
    if (!lockedUntil) return false;
    return Date.now() < lockedUntil;
  }, [lockedUntil]);

  const remainingSeconds = useCallback(() => {
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  }, [lockedUntil]);

  const recordAttempt = useCallback(() => {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS_HARD) {
      setLockedUntil(Date.now() + LOCKOUT_SEC_HARD * 1000);
    } else if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_SEC * 1000);
    }
  }, [attempts]);

  const resetRate = useCallback(() => {
    setAttempts(0);
    setLockedUntil(null);
  }, []);

  // Countdown ticker
  const [, setTick] = useState(0);
  const startCountdown = useCallback(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (!lockedUntil || Date.now() >= lockedUntil) clearInterval(id);
    }, 1000);
  }, [lockedUntil]);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const locked = isLocked();

  const switchMode = useCallback(() => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setErr(""); setOk(""); setNeedsVerify(false); setConfirmPassword("");
    setShowPassword(false); setShowConfirm(false);
  }, []);

  const hardRedirectFallback = useCallback(() => {
    window.setTimeout(() => {
      try { window.location.href = callbackUrl || "/"; } catch {}
    }, 300);
  }, [callbackUrl]);

  const resendVerification = useCallback(async () => {
    if (loading) return;
    setErr(""); setOk(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user.emailVerified) {
        setNeedsVerify(false);
        setOk("Имэйл аль хэдийн баталгаажсан байна. Одоо нэвтэрч болно.");
        onSuccess?.();
        hardRedirectFallback();
        return;
      }
      await sendEmailVerification(cred.user, { url: `${window.location.origin}/login`, handleCodeInApp: false });
      await signOut(auth);
      setNeedsVerify(true);
      setOk("Баталгаажуулах мэйл дахин явууллаа. Gmail-ээ шалгаарай.");
    } catch (error: any) {
      const code = error?.code;
      if (code === "auth/too-many-requests") setErr("Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоорой.");
      else setErr("Алдаа гарлаа. Дахин оролдоорой.");
      console.error("resend verification error:", error);
    } finally { setLoading(false); }
  }, [loading, email, password, onSuccess, hardRedirectFallback]);

  const onSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;

    if (isLocked()) {
      setErr(`Хэт олон оролдлого. ${remainingSeconds()} секунд хүлээнэ үү.`);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setErr("Имэйл хаягаа оруулна уу."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setErr("Имэйл хаяг буруу форматтай байна."); return; }
    if (!password) { setErr("Нууц үгээ оруулна уу."); return; }
    if (password.length < 6) { setErr("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой."); return; }

    if (mode === "register") {
      if (password !== confirmPassword) { setErr("Нууц үг таарахгүй байна. Дахин шалгана уу."); return; }
      if (strength.score < 3) { setErr("Нууц үг хэтэрхий сул байна. Том үсэг, тоо нэмнэ үү."); return; }
    }

    setErr(""); setOk(""); setNeedsVerify(false); setLoading(true);

    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setNeedsVerify(true);
          setErr("Имэйл баталгаажуулаагүй байна. Gmail-ээ шалгаад баталгаажуулна уу.");
          return;
        }
        resetRate();
        setOk("Амжилттай нэвтэрлээ.");
        onSuccess?.();
        hardRedirectFallback();
      } else {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user, { url: `${window.location.origin}/login`, handleCodeInApp: false });
        await signOut(auth);
        setNeedsVerify(true);
        setOk("Бүртгэл амжилттай. Gmail-ээ шалгаад баталгаажуулсны дараа нэвтэрнэ үү.");
      }
    } catch (error: any) {
      const code = error?.code as string | undefined;
      recordAttempt();
      if (isLocked()) {
        setErr(`Хэт олон оролдлого. ${remainingSeconds()} секунд хүлээнэ үү.`);
        startCountdown();
      } else if (mode === "login") {
        setErr(getLoginError(code));
      } else {
        setErr(getRegisterError(code));
      }
      console.error("auth error:", error);
    } finally { setLoading(false); }
  }, [loading, isLocked, remainingSeconds, email, password, confirmPassword, mode, strength.score, resetRate, onSuccess, hardRedirectFallback, recordAttempt, startCountdown]);

  return {
    // State
    mode, email, password, confirmPassword, showPassword, showConfirm,
    loading, err, ok, needsVerify, locked, strength,

    // Setters
    setEmail, setPassword, setConfirmPassword, setShowPassword, setShowConfirm,

    // Actions
    onSubmit, switchMode, resendVerification, remainingSeconds,
  };
}