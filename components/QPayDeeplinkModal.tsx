"use client";

type Deeplink = { name?: string; description?: string; logo?: string; link: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  urls: Deeplink[];
  statusText?: string;
  onCheck: () => void;
};

export default function QPayDeeplinkModal({ open, onClose, title, amount, urls, statusText, onCheck }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1016] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/90 text-lg font-extrabold">{title}</div>
            <div className="text-white/60 text-sm">Дүн: {Number(amount || 0).toLocaleString("mn-MN")}₮</div>
          </div>

          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            Хаах ✕
          </button>
        </div>

        {statusText ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 whitespace-pre-wrap">
            {statusText}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-white/70 text-sm font-semibold mb-2">Банк сонгоод аппаа нээнэ үү:</div>

          <div className="max-h-[340px] overflow-auto rounded-xl border border-white/10">
            {urls?.length ? (
              <div className="divide-y divide-white/10">
                {urls.map((u, idx) => (
                  <a
                    key={idx}
                    href={u.link}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 transition"
                  >
                    {u.logo ? (
                      <img src={u.logo} alt="" className="h-9 w-9 rounded-lg bg-white/5 object-contain" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-white/5" />
                    )}

                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{u.name || "Bank app"}</div>
                      <div className="text-white/55 text-xs truncate">{u.description || u.link}</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-3 text-white/60 text-sm">URLs ирсэнгүй. QPay invoice response-оо шалгаарай.</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCheck}
            className="rounded-full bg-cyan-500/90 px-4 py-2 text-sm font-extrabold text-black hover:bg-cyan-400 transition"
          >
            Төлбөр шалгах
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
          >
            Дараа нь
          </button>
        </div>
      </div>
    </div>
  );
}
