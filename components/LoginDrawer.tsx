"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // 🔹 state-ууд
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC дархад хаах
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // 🔹 LOGIN FUNCTION
  const handleLogin = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Имэйл хаягаа оруулна уу");
      return;
    }

    if (!password) {
      setError("Нууц үгээ оруулна уу");
      return;
    }

    try {
      setLoading(true);
      const redirect = sessionStorage.getItem("redirectAfterLogin");
if (redirect) {
  sessionStorage.removeItem("redirectAfterLogin");
  window.location.href = redirect;
} else {
  onClose();
}


      // ✅ Амжилттай login
      onClose();
      setEmail("");
      setPassword("");
    } catch (err: any) {
      const code = err?.code;

      if (code === "auth/invalid-credential") {
        setError("Имэйл эсвэл нууц үг буруу байна");
      } else if (code === "auth/user-not-found") {
        setError("Ийм хэрэглэгч олдсонгүй");
      } else if (code === "auth/wrong-password") {
        setError("Нууц үг буруу байна");
      } else {
        setError("Нэвтрэхэд алдаа гарлаа");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999]">
      {/* overlay */}
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close"
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-[420px] max-w-[92vw] border-l border-white/10 bg-[#0b0b0f]/95 p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          aria-label="Close drawer"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold">Нэвтрэх</h2>
        <p className="mt-2 text-sm text-white/60">
          Имэйл болон нууц үгээ оруулаад нэвтэрнэ.
        </p>

        {/* EMAIL */}
        <div className="mt-6">
          <label className="text-sm text-white/70">Имэйл хаяг</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-white/20"
            placeholder="name@email.com"
          />
        </div>

        {/* PASSWORD */}
        <div className="mt-4">
          <label className="text-sm text-white/70">Нууц үг</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-white/20"
            placeholder="••••••••"
          />
        </div>

        {/* ERROR */}
        {error && (
          <p className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        {/* BUTTON */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Нэвтэрч байна..." : "Үргэлжлүүлэх"}
        </button>
      </div>
    </div>
  );
}
