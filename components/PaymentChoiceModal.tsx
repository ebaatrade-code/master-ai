"use client";

import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPayQpay: () => void; // QR
  onPayBank: () => void; // deeplink
  title: string;
  amount: number;
};

export default function PaymentChoiceModal({
  open,
  onClose,
  onPayQpay,
  onPayBank,
  title,
  amount,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b0f14] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Төлбөрийн арга сонгох</div>
            <div className="mt-1 text-lg font-semibold text-white">{title}</div>
            <div className="mt-1 text-sm text-white/70">
              Үнэ:{" "}
              <span className="font-semibold text-white">
                {Number.isFinite(amount) ? amount.toLocaleString("mn-MN") : "0"}₮
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            onClick={onPayQpay}
            className="rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-black hover:opacity-90"
          >
            1) QPAY ашиглах
            <div className="mt-1 text-xs font-normal text-black/70">
              QR уншуулаад төлнө (QPay / камера).
            </div>
          </button>

          <button
            onClick={onPayBank}
            className="rounded-xl bg-[#0ea5e9] px-4 py-3 text-left text-sm font-semibold text-black hover:opacity-90"
          >
            2) Банкны аппаар төлөх
            <div className="mt-1 text-xs font-normal text-black/70">
              Шууд банкны апп руу үсэрч төлнө (deeplink).
            </div>
          </button>
        </div>

        <div className="mt-4 text-xs text-white/50">
          * Sandbox дээр зарим банк “QR хүчингүй” гэж гарч болно. Production дээр бүрэн ажиллана.
        </div>
      </div>
    </div>
  );
}
