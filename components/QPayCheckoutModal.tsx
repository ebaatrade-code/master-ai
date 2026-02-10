"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = {
  name?: string;
  description?: string;
  logo?: string;
  link: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  courseId: string;
  title: string;
  amount: number;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function QPayCheckoutModal({ open, onClose, courseId, title, amount }: Props) {
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrText, setQrText] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState<Deeplink[]>([]);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1024px)").matches;
  }, [open]);

  // ✅ open болох бүрт state цэвэрлэнэ
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    setOrderId(null);
    setQrText(null);
    setQrImage(null);
    setShortUrl(null);
    setUrls([]);
  }, [open]);

  // ✅ invoice үүсгэнэ (open болоод автоматаар)
  useEffect(() => {
    if (!open) return;
    if (!user) {
      setError("Нэвтэрсний дараа төлбөр үүсгэнэ.");
      return;
    }
    if (!courseId || !amount) {
      setError("courseId/amount алга байна.");
      return;
    }

    const run = async () => {
      setBusy(true);
      setError(null);

      try {
        const token = await user.getIdToken();

        const res = await fetch("/api/qpay/checkout/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ courseId, amount, title }),
        });

        const data: any = await res.json().catch(() => ({}));

        if (!res.ok) {
          // detail-ээ харуулъя (QPAY error payload)
          setError(
            data?.error ||
              data?.message ||
              (data?.detail ? JSON.stringify(data.detail) : "QPAY invoice create error")
          );
          return;
        }

        // ✅ KEY-ийн зөрүүг бүгдийг нь хамгаалж уншина
        const oid = String(data?.orderId || data?.order_id || data?.invoice_id || "");
        const qt = String(data?.qrText || data?.qr_text || "");
        const qi = String(data?.qrImage || data?.qr_image || "");
        const su = String(data?.qPay_shortUrl || data?.shortUrl || data?.qpay_shortUrl || "");
        const u = Array.isArray(data?.urls) ? (data.urls as Deeplink[]) : [];

        setOrderId(oid || null);
        setQrText(qt || null);
        setQrImage(qi || null);
        setShortUrl(su || null);
        setUrls(u);

        // ✅ хэрвээ QR өгөгдөл хоосон байвал шууд алдаа
        if (!qi && !qt) {
          setError("QPAY invoice OK боловч QR өгөгдөл хоосон ирлээ.");
        }
      } catch (e: any) {
        setError(e?.message || "Invoice үүсгэхэд алдаа гарлаа.");
      } finally {
        setBusy(false);
      }
    };

    run();
  }, [open, user, courseId, amount, title]);

  if (!open) return null;

  // ✅ base64 / data / http бүгдийг дэмжинэ
  const qrImgSrc = !qrImage
    ? ""
    : qrImage.startsWith("data:")
    ? qrImage
    : qrImage.startsWith("http")
    ? qrImage
    : `data:image/png;base64,${qrImage}`;

  const deeplinks = urls.filter((x) => x?.link).slice(0, 12);

  return (
    <div className="fixed inset-0 z-[200]">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white text-black shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-black/80">Төлбөр хүлээгдэж байна</div>
              <div className="mt-1 truncate text-xs text-black/55">{title}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-extrabold text-black/70 hover:bg-black/5"
            >
              Хаах
            </button>
          </div>

          {/* body */}
          <div className={cn("grid gap-4 p-6", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            {/* LEFT: QR */}
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="text-sm font-extrabold">QPay QR</div>

              <div className="mt-4 flex items-center justify-center">
                <div className="flex h-[320px] w-[320px] items-center justify-center rounded-2xl border border-black/10 bg-black/5">
                  {busy ? (
                    <div className="text-xs font-bold text-black/55">QR үүсгэж байна…</div>
                  ) : qrImgSrc ? (
                    <img
                      src={qrImgSrc}
                      alt="QPay QR"
                      className="h-[260px] w-[260px] rounded-xl bg-white object-contain"
                    />
                  ) : (
                    <div className="text-xs font-bold text-black/55">QR хараахан бэлэн биш</div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-center">
                <div className="text-xs text-black/55">Нийт төлөх дүн:</div>
                <div className="text-2xl font-extrabold">{amount.toLocaleString("mn-MN")}₮</div>
              </div>

              <div className="mt-4 rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-xs text-black/60">
                Компьютер дээр: QR-aa банкны app-аараа уншуулаад төлнө.
              </div>

              {shortUrl ? (
                <div className="mt-3 text-xs text-black/60">
                  Short URL:{" "}
                  <a className="font-bold text-blue-600 underline" href={shortUrl} target="_blank" rel="noreferrer">
                    {shortUrl}
                  </a>
                </div>
              ) : null}
            </div>

            {/* RIGHT: Cart + Deeplink (mobile-д илүү хэрэгтэй) */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-black/10 bg-white p-5">
                <div className="text-sm font-extrabold">Таны сагс</div>

                <div className="mt-3 rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-black/80 truncate">{title}</div>
                      <div className="mt-1 text-[11px] text-black/45">Контент</div>
                    </div>
                    <div className="text-sm font-extrabold">{amount.toLocaleString("mn-MN")}₮</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-black/55">
                  <div>Нийт төлөх дүн</div>
                  <div className="text-sm font-extrabold text-black">{amount.toLocaleString("mn-MN")}₮</div>
                </div>

                <div className="mt-3 rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-xs text-black/60">
                  Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold">Төлбөрийн хэрэгсэл</div>
                  <div className="text-[11px] text-black/45">{isMobile ? "Утсаар: Deeplink" : "Компьютер: QR"}</div>
                </div>

                {isMobile ? (
                  <div className="mt-3">
                    {deeplinks.length ? (
                      <div className="grid grid-cols-2 gap-3">
                        {deeplinks.map((u, idx) => (
                          <a
                            key={idx}
                            href={u.link}
                            className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 hover:bg-black/5"
                          >
                            {u.logo ? (
                              <img src={u.logo} alt="" className="h-8 w-8 rounded-lg border border-black/10 object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-lg border border-black/10 bg-black/5" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-xs font-extrabold text-black/85">{u.name || "Bank"}</div>
                              <div className="truncate text-[11px] text-black/50">{u.description || ""}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-xs text-black/60">
                        Deeplink хараахан бэлэн биш
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-xs text-black/60">
                    QR-аар төлнө. (Утсаараа банкны апп нээгээд QR уншуулна)
                  </div>
                )}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 whitespace-pre-wrap">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // зөвхөн UI refresh
                    if (!user) return;
                    // modal reopen хийх хамгийн энгийн refresh
                    onClose();
                    setTimeout(() => {
                      // parent open=true бол энэ ажиллахгүй, гэхдээ ихэнхдээ modal parent дээр setOpen(false) ашигладаг.
                      // Чи parent-ээсээ "reopen" хэрэгтэй бол хэлээрэй, би course page дээр нь зөв hook өгнө.
                    }, 50);
                  }}
                  className="rounded-xl border border-black/10 bg-white px-5 py-3 text-xs font-extrabold text-black/70 hover:bg-black/5"
                >
                  Дахин үүсгэх
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-black px-6 py-3 text-xs font-extrabold text-white hover:bg-black/85"
                >
                  Ок
                </button>
              </div>

              {orderId ? (
                <div className="text-[11px] text-black/45">
                  Order: <span className="font-mono">{orderId}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}