"use client";

type Props = {
  level: number;
  purchasedCount: number;
  onBrowse: () => void;
};

export default function UpsellSection({ level, purchasedCount, onBrowse }: Props) {
  const msg =
    level >= 4
      ? "Та Master түвшинд байна. Илүү өндөр үр дүн авахад туслах advanced багцууд бий."
      : level === 3
      ? "Pro түвшин дээр хамгийн их авдаг нь: Video + Automation багц."
      : level === 2
      ? "Creator түвшинд хамгийн их өсөлт өгдөг нь: AI Video суурь багц."
      : "Beginner түвшинд суурь багцаа аваад хурдан ахина.";

  const rec1 =
    purchasedCount >= 3 ? "AI Video (Pro)" : "AI Image (Starter)";
  const rec2 =
    purchasedCount >= 5 ? "Automation + ManyChat" : "AI Video (Starter)";
  const rec3 =
    purchasedCount >= 8 ? "Master Bundle" : "Prompt Library";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold text-white/90">
            💡 Танд тохирох дараагийн алхам
          </div>
          <div className="mt-1 text-sm text-white/55">{msg}</div>
        </div>

        <button
          onClick={onBrowse}
          className="w-full sm:w-auto rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-extrabold text-white/80 hover:bg-white/10 transition"
        >
          Бүх багцууд →
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[rec1, rec2, rec3].map((t) => (
          <div
            key={t}
            className="
              rounded-2xl border border-white/10 bg-white/5 p-4
              hover:bg-white/10 transition
            "
          >
            <div className="text-sm font-extrabold text-white/90">{t}</div>
            <div className="mt-1 text-xs text-white/55">
              Энэ бол таны түвшинд хамгийн их сонгогддог upgrade.
            </div>
            <button
              onClick={onBrowse}
              className="mt-4 w-full rounded-full border border-orange-300/30 bg-orange-500/10 px-4 py-2 text-xs font-extrabold text-orange-200 hover:bg-orange-500/15 transition"
            >
              Нээх →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
