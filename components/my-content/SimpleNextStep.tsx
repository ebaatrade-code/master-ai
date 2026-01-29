"use client";

type Props = {
  purchasedCount: number;
  onBrowse: () => void;
};

export default function SimpleNextStep({ purchasedCount, onBrowse }: Props) {
  const picks =
    purchasedCount <= 1
      ? [
          { t: "AI Video (Pro)", d: "Видео хийх ур чадвараа хурдан өсгөх." },
          { t: "Prompt Library", d: "Бэлэн prompt-уудаар шууд үр дүн гаргах." },
          { t: "Automation + ManyChat", d: "Системтэй борлуулалт автоматжуулах." },
        ]
      : [
          { t: "Automation + ManyChat", d: "Борлуулалт систем болгож дараагийн түвшин рүү." },
          { t: "AI Video (Pro)", d: "Контент чанараа 2–3 дахин өсгөх." },
          { t: "Prompt Library", d: "Хугацаа хэмнээд илүү хурдан бүтээх." },
        ];

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-white/90">Танд тохирох дараагийн алхам</div>
          <div className="mt-1 text-xs text-white/55">
            Шинэ түвшин рүү ороход хамгийн их нөлөөлдөг 3 сонголт.
          </div>
        </div>

        <button
          onClick={onBrowse}
          className="
            rounded-full border-2 border-orange-300/40
            bg-orange-500/10 px-4 py-2
            text-xs font-extrabold text-orange-200
            hover:bg-orange-500/15 transition
          "
        >
          Бүгдийг үзэх →
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {picks.map((p) => (
          <div
            key={p.t}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
          >
            <div className="text-sm font-extrabold text-white/90">{p.t}</div>
            <div className="mt-1 text-xs leading-5 text-white/60">{p.d}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-white/55">
          ⚡ Ихэнх хэрэглэгч дараагийн багцаа авснаар “тогтмол ахиц” эхэлдэг.
        </div>

        <button
          onClick={onBrowse}
          className="
            w-full sm:w-auto rounded-full
            border-2 border-orange-300/40
            bg-gradient-to-r from-orange-400 to-orange-600
            px-5 py-3 text-sm font-extrabold text-black
            shadow-[0_0_22px_rgba(251,146,60,0.85)]
            hover:shadow-[0_0_36px_rgba(251,146,60,1)]
            transition-all
          "
        >
          Дараагийн багц авах →
        </button>
      </div>
    </div>
  );
}
