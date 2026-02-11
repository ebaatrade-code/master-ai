"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type Props = {
  open: boolean;
  onClose: () => void;
  courseId: string;
  title: string;
  amount: number;
};

type CreateResp = {
  ok?: boolean;
  orderId?: string;
  invoiceDocId?: string;
  ref?: string;

  qrImageDataUrl?: string | null;
  qrImage?: string | null;
  qr_image?: string | null;

  shortUrl?: string | null;
  urls?: Deeplink[];

  message?: string;
  error?: string;
};

type CheckResp = {
  ok?: boolean;
  paid?: boolean;
  status?: string;
  message?: string;
  error?: string;
};

function toDataUrlMaybe(v?: string | null) {
  if (!v) return null;
  const s = String(v);
  if (!s) return null;
  if (s.startsWith("data:image/")) return s;
  // base64 png гэж үзээд хөрвүүлнэ
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 50) return `data:image/png;base64,${s}`;
  return s; // url байж болно
}

export default function QPayCheckoutModal({ open, onClose, courseId, title, amount }: Props) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "PAID" | "ERROR">("IDLE");
  const [err, setErr] = useState<string | null>(null);

  const [refId, setRefId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState<Deeplink[]>([]);

  const money = useMemo(
    () => (Number.isFinite(amount) ? `${amount.toLocaleString("mn-MN")}₮` : "0₮"),
    [amount]
  );

  async function createInvoice() {
    if (!user) {
      setStatus("ERROR");
      setErr("Нэвтэрч орсны дараа төлбөр үүсгэнэ.");
      return;
    }
    if (!courseId) return;

    setLoading(true);
    setErr(null);
    setStatus("IDLE");

    try {
      const idToken = await user.getIdToken();

      const res = await fetch("/api/qpay/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ courseId, amount, title }),
      });

      const j = (await res.json().catch(() => ({}))) as CreateResp;

      if (!res.ok || !j?.ok) {
        setStatus("ERROR");
        setErr(j?.message || j?.error || "Invoice үүсгэхэд алдаа гарлаа.");
        return;
      }

      const rid = String(j.orderId || j.invoiceDocId || j.ref || "");
      setRefId(rid || null);

      const q =
        (j.qrImageDataUrl && String(j.qrImageDataUrl)) ||
        toDataUrlMaybe(j.qrImage) ||
        toDataUrlMaybe(j.qr_image);

      setQrSrc(q);
      setShortUrl(j.shortUrl ? String(j.shortUrl) : null);
      setUrls(Array.isArray(j.urls) ? j.urls : []);

      setStatus("PENDING");
    } catch (e: any) {
      setStatus("ERROR");
      setErr(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }

  async function checkPaymentOnce() {
    if (!user || !refId) return;

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/qpay/checkout/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId: refId }),
      });

      const j = (await res.json().catch(() => ({}))) as CheckResp;
      if (!res.ok || !j?.ok) return;

      const paid = j.paid === true || String(j.status || "").toUpperCase() === "PAID";

      if (paid) {
        setStatus("PAID");
        onClose();
        window.location.reload();
      } else {
        setStatus("PENDING");
      }
    } catch {
      // ignore
    }
  }

  // open үед invoice үүсгэнэ
  useEffect(() => {
    if (!open) return;

    setErr(null);
    setRefId(null);
    setQrSrc(null);
    setShortUrl(null);
    setUrls([]);
    setStatus("IDLE");

    createInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId]);

  // pending үед polling
  useEffect(() => {
    if (!open) return;
    if (!refId) return;
    if (status !== "PENDING") return;

    const t = setInterval(() => {
      checkPaymentOnce();
    }, 2500);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refId, status]);

  if (!open) return null;

  return (
    // ✅ Overlay өөрөө scroll авах ёстой (mobile дээр)
    <div className="fixed inset-0 z-[999] bg-black/70 overflow-y-auto">
      {/* ✅ items-start байхгүй бол iOS дээр scroll гацах үе байдаг */}
      <div className="min-h-full w-full flex items-start justify-center p-3 md:p-6">
        {/* ✅ Card өөрөө дотроо scroll-доно */}
        <div
          className="w-full max-w-4xl rounded-2xl bg-white text-black shadow-[0_40px_120px_rgba(0,0,0,0.45)]
                     max-h-[calc(100dvh-24px)] overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* HEADER (sticky) */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-black/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] md:text-[16px] font-extrabold">Төлбөр хүлээгдэж байна</div>
                <div className="mt-0.5 text-xs text-black/60">
                  Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
                </div>
              </div>

              <button
                onClick={onClose}
                className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-xs font-bold hover:bg-black/5"
              >
                Хаах
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="px-5 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* LEFT: QR */}
              <div className="rounded-2xl border border-black/10 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6b4bff]/10">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#6b4bff]" />
                  </span>
                  QPay QR
                </div>

                <div className="mt-4 rounded-2xl bg-black/5 p-4 flex items-center justify-center">
                  <div className="w-full max-w-[340px] rounded-2xl bg-white p-4 border border-black/10">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-full bg-[#6b4bff]" />
                      <div className="text-sm font-extrabold">QPay</div>
                    </div>

                    <div className="rounded-2xl bg-black/5 p-3 flex items-center justify-center">
                      {qrSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrSrc}
                          alt="QPay QR"
                          className="w-[260px] h-[260px] object-contain bg-white rounded-xl"
                        />
                      ) : (
                        <div className="h-[260px] w-[260px] flex items-center justify-center text-sm text-black/50">
                          QR ачаалж байна...
                        </div>
                      )}
                    </div>

                    <div className="mt-4 text-center text-xs text-black/60">Нийт төлөх дүн:</div>
                    <div className="mt-1 text-center text-2xl font-extrabold">{money}</div>

                    <div className="mt-3 rounded-xl bg-black/5 px-4 py-3 text-xs text-black/60 text-center">
                      Компьютер дээр: QR-aa банкны апп-аараа уншуулж төлнө.
                    </div>

                    {shortUrl ? (
                      <div className="mt-3 text-xs break-all">
                        Short URL:{" "}
                        <a className="text-blue-600 underline" href={shortUrl} target="_blank" rel="noreferrer">
                          {shortUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>

                {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
              </div>

              {/* RIGHT */}
              <div className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-extrabold">Контентууд</div>

                <div className="mt-3 rounded-2xl border border-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{title}</div>
                      <div className="mt-1 text-xs text-black/55">Контент</div>
                    </div>
                    <div className="text-sm font-extrabold">{money}</div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-black/60">
                    <span>Нийт дүн</span>
                    <span className="font-bold text-black/75">{money}</span>
                  </div>
                </div>

                {/* ✅ BANK/APPS: ЗӨВХӨН MOBILE дээр харагдана */}
                <div className="mt-5 md:hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">Төлбөрийн хэрэгсэл</div>
                    <div className="text-xs text-black/55">Компьютер: QR</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(urls || []).slice(0, 10).map((u, idx) => (
                      <a
                        key={`${u.link}-${idx}`}
                        href={u.link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-black/5 hover:bg-black/10 px-4 py-3 text-sm text-black/80"
                      >
                        {u.name || u.description || "Bank"}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="mt-5 text-sm">
                  Status:{" "}
                  {status === "PAID"
                    ? "✅ PAID"
                    : loading
                    ? "⏳ Үүсгэж байна..."
                    : status === "PENDING"
                    ? "PENDING"
                    : status === "ERROR"
                    ? "ERROR"
                    : "—"}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => createInvoice()}
                    className="rounded-full border border-black/20 px-5 py-3 text-sm font-bold hover:bg-black/5 disabled:opacity-60"
                  >
                    Дахин ачаалах
                  </button>

                  <button
                    type="button"
                    onClick={() => checkPaymentOnce()}
                    className="rounded-full bg-black text-white px-7 py-3 text-sm font-extrabold hover:bg-black/90"
                  >
                    Ok
                  </button>
                </div>

                {/* ✅ mobile дээр доод зай нэмээд scroll “наалдац” арилгана */}
                <div className="h-6 md:h-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}