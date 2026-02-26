// FILE: app/pay/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import QPayModal from "@/components/QPayModal";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type InvoiceDoc = {
  uid: string;
  courseId?: string;
  courseTitle?: string;
  courseThumbUrl?: string | null;
  amount?: number;
  status?: string;
  createdAt?: any;
  paidAt?: any;
  durationLabel?: string | null;
  durationDays?: number | null;
  qpay?: {
    ref?: string;
    qpayInvoiceId?: string | null;
    senderInvoiceNo?: string | null;
    qrText?: string | null;
    qrImageDataUrl?: string | null;
    shortUrl?: string | null;
    urls?: Deeplink[];
  };
};

function fmt(ts: any) {
  try {
    const d =
      ts instanceof Timestamp ? ts.toDate() :
      ts?.toDate ? ts.toDate() :
      ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function PayContinuePage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const invoiceId = String(params?.id ?? "").trim();

  const { user, loading } = useAuth();

  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/pay/${invoiceId}`)}`);
      return;
    }
  }, [loading, user, router, invoiceId]);

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;
    if (!invoiceId) return;

    const run = async () => {
      setErr(null);
      setInv(null);

      try {
        const snap = await getDoc(doc(db, "invoices", invoiceId));
        if (!snap.exists()) {
          setErr("Invoice олдсонгүй.");
          return;
        }
        const data = snap.data() as InvoiceDoc;

        if (String(data?.uid || "") !== user.uid) {
          setErr("Зөвшөөрөлгүй (өөр хүний invoice).");
          return;
        }

        setInv({ ...data });
      } catch (e: any) {
        setErr(e?.message || "Алдаа гарлаа");
      }
    };

    run();
  }, [loading, user?.uid, invoiceId]);

  const qpayData = useMemo(() => {
    if (!inv) return null;
    // invoice id == qpayPayments ref гэж тохируулсан
    const ref = invoiceId;

    return {
      ref,
      qrImageDataUrl: inv?.qpay?.qrImageDataUrl ?? null,
      shortUrl: inv?.qpay?.shortUrl ?? null,
      urls: Array.isArray(inv?.qpay?.urls) ? inv!.qpay!.urls : [],
      durationLabel: inv?.durationLabel ?? null,
      durationDays: typeof inv?.durationDays === "number" ? inv.durationDays : null,
    };
  }, [inv, invoiceId]);

  if (loading) {
    return <div className="min-h-[calc(100vh-80px)] p-6 text-black/70">Уншиж байна...</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-80px)] text-black">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8 pb-14">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-lg font-extrabold">Төлбөр үргэлжлүүлэх</div>

          {err ? (
            <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          ) : inv ? (
            <div className="mt-3 text-sm text-black/70">
              <div>Invoice: #{invoiceId.slice(0, 8).toUpperCase()}</div>
              <div className="mt-1">Огноо: {fmt(inv.createdAt)}</div>
              <div className="mt-1">
                Төлөв: <span className="text-black/90 font-semibold">{String(inv.status || "—")}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-black/60">Уншиж байна...</div>
          )}

          <div className="mt-4 text-xs text-black/45">
            Энэ хуудсанд ормогц төлбөрийн цонх автоматаар нээгдэнэ.
          </div>
        </div>
      </div>

      {/* QPay modal */}
      <QPayModal
        open={open && !!qpayData}
        onClose={() => {
          setOpen(false);
          router.back();
        }}
        data={qpayData}
        amount={Number(inv?.amount ?? 0)}
        courseTitle={String(inv?.courseTitle || inv?.courseId || "Master AI")}
        courseThumbUrl={(inv?.courseThumbUrl as any) ?? null}
        onPaid={() => {
          // paid болмогц history/мөр update болно (check route sync хийж байгаа)
          setOpen(false);
          router.replace(inv?.courseId ? `/course/${inv.courseId}` : "/purchases");
        }}
      />
    </div>
  );
}