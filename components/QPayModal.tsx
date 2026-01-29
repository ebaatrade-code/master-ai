"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  amountText: string;
  qrImage?: string;
  qrText?: string;
  urls?: Array<{ name?: string; link?: string; description?: string }>;
  statusText?: string;
};

function normalizeImgSrc(qrImage?: string) {
  if (!qrImage) return "";
  if (qrImage.startsWith("data:image/")) return qrImage;
  if (qrImage.startsWith("http://") || qrImage.startsWith("https://")) return qrImage;
  return `data:image/png;base64,${qrImage}`;
}

export default function QPayModal({
  open,
  onClose,
  title,
  amountText,
  qrImage,
  qrText,
  urls,
  statusText,
}: Props) {
  if (!open) return null;

  const imgSrc = normalizeImgSrc(qrImage);

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0f14] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-white/60">QPay төлбөр</div>
            <div className="mt-1 text-lg font-extrabold text-white">{title}</div>
            <div className="mt-1 text-sm text-white/70">Дүн: {amountText}</div>
            {statusText ? (
              <div className="mt-2 text-xs font-semibold text-cyan-300">{statusText}</div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
          >
            Хаах ✕
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-white/85">QR</div>

            <div className="mt-3 grid place-items-center">
              {imgSrc ? (
                <img src={imgSrc} alt="QPay QR" className="max-h-[280px] w-auto rounded-xl" />
              ) : (
                <div className="text-sm text-white/50">QR үүсгэж байна…</div>
              )}
            </div>

            {qrText ? (
              <div className="mt-3 break-all rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                {qrText}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-white/85">Банкууд</div>

            <div className="mt-3 space-y-2">
              {(urls ?? []).length ? (
                (urls ?? []).map((u, idx) => (
                  <a
                    key={idx}
                    href={u.link || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/85 hover:bg-white/10"
                  >
                    {u.name || u.description || "Bank"} →
                  </a>
                ))
              ) : (
                <div className="text-sm text-white/50">Банк линк ирээгүй.</div>
              )}
            </div>

            <div className="mt-4 text-xs text-white/45">
              QR-г банкны апп-аараа уншаад төлөөд, төлбөр баталгаажмагц курс автоматаар нээгдэнэ.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
