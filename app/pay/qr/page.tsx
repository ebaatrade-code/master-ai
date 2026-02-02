"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

export default function PayQrPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const orderId = sp.get("orderId") || "";
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Уншиж байна…");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [urls, setUrls] = useState<Deeplink[]>([]);
  const [paid, setPaid] = useState(false);

  // fetch order detail (simpler: re-create not needed; we stored raw in Firestore but client cannot read admin)
  // so we pass qr_image & urls via create response normally.
  // Here: we assume you navigate here right after create and store payload in sessionStorage.
  useEffect(() => {
    if (!orderId) return;

    const raw = sessionStorage.getItem(`qpay_qr_${orderId}`);
    if (!raw) {
      setLoading(false);
      setStatusText("Order мэдээлэл олдсонгүй. Дахин АВАХ дарж оролдоно уу.");
      return;
    }

    try {
      const data = JSON.parse(raw);
      setQrImage(data.qr_image || null);
      setUrls(Array.isArray(data.urls) ? data.urls : []);
      setStatusText("QR уншуулж төлнө үү. Төлсний дараа автоматаар баталгаажина.");
    } catch {
      setStatusText("Order мэдээлэл уншихад алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // polling check
  useEffect(() => {
    if (!user || !orderId) return;
    if (paid) return;

    let stopped = false;

    const tick = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/qpay/qr/check", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (!res.ok) return;

        if (data.status === "PAID") {
          setPaid(true);
          setStatusText("Төлбөр баталгаажлаа ✅ Курс нээгдлээ!");
          // буцаад course list refresh
          setTimeout(() => router.push("/my-courses"), 900);
        }
      } catch {}
    };

    const interval = setInterval(() => {
      if (!stopped) tick();
    }, 2500);

    tick();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [user, orderId, paid, router]);

  const openBank = (link: string) => {
    window.location.href = link;
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur p-6">
        <div className="text-sm text-white/60">Төлбөр</div>
        <div className="mt-1 text-xl font-extrabold text-white">QPAY QR</div>

        <div className="mt-3 text-sm text-white/70">{statusText}</div>

        {loading ? (
          <div className="mt-6 text-white/60">Ачааллаж байна…</div>
        ) : (
          <>
            {/* QR */}
            <div className="mt-6 grid place-items-center">
              {qrImage ? (
                // qr_image нь base64 data-url эсвэл plain base64 байж болно.
                <img
                  src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                  alt="QPay QR"
                  className="h-64 w-64 rounded-2xl bg-white p-3"
                />
              ) : (
                <div className="text-white/50">QR зураг ирсэнгүй</div>
              )}
            </div>

            {/* Bank list */}
            {urls.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-white/80">Эсвэл банкны аппаар:</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {urls
                    .filter((u) => !!u.link)
                    .slice(0, 12)
                    .map((u, idx) => (
                      <button
                        key={idx}
                        onClick={() => openBank(u.link)}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                      >
                        {u.logo ? (
                          <img src={u.logo} alt="" className="h-9 w-9 rounded-xl bg-white/10 object-contain" />
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-white/10" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{u.name || "Bank"}</div>
                          <div className="truncate text-xs text-white/60">{u.description || "Open app"}</div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
