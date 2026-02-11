"use client";

import Image from "next/image";
import { useMemo } from "react";

type Props = {
  open: boolean;
  onClose: () => void;

  // API-аас ирэх
  qrImageDataUrl: string | null;
  amount: number;
  courseTitle: string;
  courseThumbUrl?: string | null;

  // optional
  shortUrl?: string | null;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function formatMnt(n: number) {
  try {
    return new Intl.NumberFormat("mn-MN").format(n);
  } catch {
    return String(n);
  }
}

export default function QPayPendingModal(props: Props) {
  const { open, onClose, qrImageDataUrl, amount, courseTitle, courseThumbUrl, shortUrl } = props;

  const canShowQr = useMemo(() => typeof qrImageDataUrl === "string" && qrImageDataUrl.startsWith("data:image/"), [qrImageDataUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-[1100px] rounded-2xl bg-white shadow-2xl">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
            <div>
              <div className="text-[18px] font-semibold text-neutral-900">Төлбөр хүлээгдэж байна</div>
              <div className="mt-1 text-[13px] text-neutral-500">
                Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50"
            >
              Хаах
            </button>
          </div>

          {/* body */}
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            {/* LEFT: QR */}
            <div className="rounded-2xl border bg-white p-6">
              <div className="text-[13px] font-medium text-neutral-700">QPay QR</div>

              <div className="mt-4 flex flex-col items-center">
                <div className="flex items-center gap-2">
                  {/* simple QPay mark (text logo) */}
                  <div className="h-8 w-8 rounded-full bg-[#5b2cff] opacity-90" />
                  <div className="text-[16px] font-semibold text-neutral-900">QPay</div>
                </div>

                <div className="mt-4 rounded-2xl bg-neutral-100 p-4">
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl bg-white">
                    {canShowQr ? (
                      // QR
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrImageDataUrl!}
                        alt="QPay QR"
                        className="h-[260px] w-[260px] object-contain"
                      />
                    ) : (
                      <div className="text-center text-[13px] text-neutral-500">
                        QR хараахан бэлэн биш
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 text-[12px] text-neutral-500">Нийт төлөх дүн:</div>
                <div className="text-[28px] font-semibold text-neutral-900">{formatMnt(amount)}₮</div>

                <div className="mt-4 w-full rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                  Компьютер дээр: QR-аa банкны апп-аараа уншуулж төлнө.
                </div>

                {shortUrl ? (
                  <div className="mt-3 w-full text-[13px] text-neutral-600">
                    Short URL:{" "}
                    <a className="text-blue-600 underline" href={shortUrl} target="_blank" rel="noreferrer">
                      {shortUrl}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT: Order info */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border bg-white p-6">
                <div className="text-[13px] font-medium text-neutral-700">Таны сагс</div>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-neutral-200">
                      {courseThumbUrl ? (
                        <Image
                          src={courseThumbUrl}
                          alt={courseTitle}
                          width={48}
                          height={48}
                          className="h-12 w-12 object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-neutral-900">{courseTitle}</div>
                      <div className="text-[12px] text-neutral-500">Контент</div>
                    </div>
                  </div>

                  <div className="text-[14px] font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[13px] text-neutral-700">
                  <div className="text-neutral-500">Нийт төлөх дүн</div>
                  <div className="font-semibold text-neutral-900">{formatMnt(amount)}₮</div>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                  Төлбөр төлөгдсөний дараа таны худалдан авалт автоматаар баталгаажина.
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-neutral-700">Төлбөрийн хэрэгсэл</div>
                  <div className="text-[12px] text-neutral-500">Компьютер: QR</div>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
                  QR-аар төлнө. (Утсаараа банкны апп нээгээд QR уншуулна)
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-xl border px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50"
                  >
                    Дахин үүсгэх
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-black px-5 py-2 text-[13px] text-white hover:bg-black/90"
                  >
                    Ок
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* footer spacing */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}