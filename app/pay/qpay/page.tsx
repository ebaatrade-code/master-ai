// FILE: app/pay/qpay/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type InvoiceUi = {
  invoiceDocId: string;
  qpayInvoiceId: string;
  amount: number;
  description: string;
  qrText: string | null;
  qrImageDataUrl: string | null;
  shortUrl: string | null;
  urls: Array<{ name: string; description?: string; logo?: string; link: string }>;
};

export default function QPayPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();

  const courseId = sp.get("courseId") || "";
  const amount = Number(sp.get("amount") || "0");
  const title = sp.get("title") || "Сургалт";

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const pollRef = useRef<number | null>(null);

  const isValid = useMemo(() => {
    return Boolean(courseId) && Number.isFinite(amount) && amount > 0;
  }, [courseId, amount]);

  async function create() {
    setError(null);
    setPaid(false);

    if (!isValid) {
      setError("Төлбөрийн өгөгдөл буруу байна (courseId/amount).");
      return;
    }
    if (!user) {
      setError("Нэвтэрсэн байх шаардлагатай.");
      return;
    }

    setCreating(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/qpay/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          amount,
          description: title,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || `QPAY invoice create failed (${res.status})`);
      }

      const inv: InvoiceUi = {
        invoiceDocId: String(data.invoiceDocId),
        qpayInvoiceId: String(data.qpayInvoiceId),
        amount: Number(data.amount),
        description: String(data.description || title),
        qrText: data.qrText ?? null,
        qrImageDataUrl: data.qrImageDataUrl ?? null,
        shortUrl: data.shortUrl ?? null,
        urls: Array.isArray(data.urls) ? data.urls : [],
      };

      setInvoice(inv);

      // ✅ If QR still null, show explicit reason
      if (!inv.qrImageDataUrl && !inv.qrText) {
        setError("QPay QR өгөгдөл ирсэнгүй (qr_text/qr_image хоёулаа хоосон).");
      }
    } catch (e: any) {
      setError(typeof e?.message === "string" ? e.message : "Алдаа гарлаа");
      setInvoice(null);
    } finally {
      setCreating(false);
    }
  }

  async function startPolling() {
    if (!user || !invoice) return;

    // clear old
    if (pollRef.current) window.clearInterval(pollRef.current);

    const tick = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/qpay/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ invoiceDocId: invoice.invoiceDocId }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.paid) {
          setPaid(true);
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // polling үед тасалдуулахгүй
      }
    };

    await tick();
    pollRef.current = window.setInterval(tick, 3000);
  }

  useEffect(() => {
    if (invoice && user && !paid) startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, user, paid]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  useEffect(() => {
    // auto-create once (optional): when page opens and valid params exist
    if (!invoice && !creating && !loading && isValid) {
      // do not auto-run if user not ready
    }
  }, [invoice, creating, loading, isValid]);

  return (
    <div className="min-h-[calc(100vh-80px)] px-4 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Төлбөр хүлээгдэж байна</div>
            <div className="text-sm text-neutral-500">{title}</div>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm"
          >
            Хаах
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT: QR */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 text-sm font-medium">QPay QR</div>

            <div className="flex flex-col items-center justify-center">
              <div className="flex h-[340px] w-[260px] items-center justify-center rounded-2xl bg-neutral-100">
                {invoice?.qrImageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invoice.qrImageDataUrl}
                    alt="QPay QR"
                    className="h-[240px] w-[240px] rounded-xl"
                  />
                ) : (
                  <div className="px-6 text-center text-xs text-neutral-500">
                    QR хараахан бэлэн биш
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                Компьютер дээр: QR-аа банкны app-аараа уншуулаад төлнө.
              </div>

              <div className="mt-2 text-2xl font-semibold">{amount.toLocaleString()}₮</div>
            </div>
          </div>

          {/* RIGHT: Details + bank deep links */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="mb-2 text-sm font-medium">Таны сагс</div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-neutral-500">Контент</div>
                </div>
                <div className="text-sm font-semibold">{amount.toLocaleString()}₮</div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-neutral-600">Нийт төлөх дүн</div>
                <div className="font-semibold">{amount.toLocaleString()}₮</div>
              </div>

              <div className="mt-3 rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-600">
                Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Төлбөрийн хэрэгсэл</div>
                <div className="text-xs text-neutral-500">Утас: app</div>
              </div>

              <div className="rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-600">
                Утсаараа: банкны app дээр дарж нээгээд төлнө.
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {(invoice?.urls || []).slice(0, 12).map((u) => (
                  <a
                    key={u.name}
                    href={u.link}
                    className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white p-2"
                    title={u.description || u.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.logo || ""}
                      alt={u.name}
                      className="h-10 w-10 rounded-lg object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span className="sr-only">{u.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {paid && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-[13px] text-emerald-800">
                Төлбөр амжилттай. Одоо та сургалтаа үзэх боломжтой.
                <div className="mt-3">
                  <button
                    onClick={() => router.push(`/course/${courseId}`)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
                  >
                    Сургалт руу очих
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={create}
                    disabled={creating}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm"
                  >
                    Дахин үүсгэх
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="rounded-xl bg-black px-4 py-2 text-sm text-white"
                  >
                    Ok
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={creating || !user}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {creating ? "Үүсгэж байна..." : "Invoice үүсгэх"}
              </button>

              <button
                onClick={() => setInvoice(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm"
              >
                Цэвэрлэх
              </button>
            </div>

            {!user && (
              <div className="text-xs text-neutral-500">
                Төлбөр хийхийн тулд нэвтэрсэн байх шаардлагатай.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}