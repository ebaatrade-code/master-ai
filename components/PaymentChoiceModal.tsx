"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onChooseQpay: () => void;
  onChooseBank: () => void;
};

export default function PaymentChoiceModal({ open, onClose, onChooseQpay, onChooseBank }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1016] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-white/90 text-lg font-extrabold">Төлбөр хийх хэлбэр</div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            Хаах ✕
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <button
            onClick={onChooseQpay}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
          >
            <div className="text-white font-bold">1) QPAY ашиглах</div>
            <div className="text-white/60 text-sm mt-1">QR / QPay сонголтууд (дараа нь production дээр идэвхжинэ)</div>
          </button>

          <button
            onClick={onChooseBank}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
          >
            <div className="text-white font-bold">2) Банкны аппаар төлөх</div>
            <div className="text-white/60 text-sm mt-1">Khanbank, TDB, Golomt, … deeplink-ээр шууд нээх</div>
          </button>
        </div>
      </div>
    </div>
  );
}
