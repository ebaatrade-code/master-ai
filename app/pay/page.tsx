// app/pay/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function PayPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, loading } = useAuth();

  const orderId = sp.get("orderId") || "";
  const [status, setStatus] = useState<"INIT" | "PENDING" | "PAID" | "ERROR">("INIT");
  const [msg, setMsg] = useState<string>("Төлбөрийн мэдээлэл ачаалж байна…");
  const [courseId, setCourseId] = useState<string>("");

  const canStart = useMemo(() => !loading && !!user && !!orderId, [loading, user, orderId]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // ✅ login хийлгээд буцааж энэ pay page руу авчирна
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/pay?orderId=${orderId}`)}`);
      return;
    }

    if (!orderId) {
      setStatus("ERROR");
      setMsg("orderId алга байна. Дахин АВАХ дарж оролдоно уу.");
      return;
    }
  }, [loading, user, orderId, router]);

  useEffect(() => {
    if (!canStart) return;

    let alive = true;
    let tries = 0;
    const MAX_TRIES = 45; // ~90 секунд (2сек тутам)

    const tick = async () => {
      tries += 1;
      try {
        if (!alive) return;

        setStatus("PENDING");
        setMsg("Төлбөр баталгаажуулж байна… (апп-аас буцаад ирсэн бол хүлээгээрэй)");

        const idToken = await user!.getIdToken();

        const res = await fetch("/api/qpay/deeplink/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ orderId }),
        });

        const data = await res.json();

        if (!alive) return;

        if (!res.ok) {
          setStatus("ERROR");
          setMsg(data?.message || data?.error || "Шалгах үед алдаа гарлаа.");
          return;
        }

        if (data.status === "PAID") {
          setStatus("PAID");
          setCourseId(data.courseId || "");
          setMsg("Төлбөр баталгаажлаа ✅ Курс нээгдлээ!");
          // ✅ course руу оруулна
          const cid = data.courseId;
          if (cid) {
            router.replace(`/course/${cid}`);
          } else {
            router.replace("/my-content");
          }
          return;
        }

        // PENDING
        if (tries >= MAX_TRIES) {
          setStatus("ERROR");
          setMsg("Одоогоор төлбөр баталгаажаагүй байна. Банкны апп дээр төлсөн эсэхээ шалгаад дахин оролдоно уу.");
          return;
        }
      } catch (e: any) {
        if (!alive) return;
        setStatus("ERROR");
        setMsg(e?.message || "Шалгах үед алдаа гарлаа.");
      }
    };

    // first tick immediately
    tick();

    const iv = window.setInterval(() => {
      tick();
    }, 2000);

    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [canStart, orderId, user, router]);

  return (
    <div className="min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="text-lg font-extrabold text-white">Төлбөр баталгаажуулж байна</div>

        <div className="mt-2 text-sm text-white/60">
          Order: <span className="font-mono text-white/80">{orderId || "-"}</span>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          {msg}
        </div>

        {status === "ERROR" ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => router.replace("/")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Нүүр рүү
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Дахин шалгах
            </button>
          </div>
        ) : null}

        {status === "PAID" && (
          <div className="mt-4 text-sm text-green-300">
            Амжилттай. {courseId ? `Курс: ${courseId}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
