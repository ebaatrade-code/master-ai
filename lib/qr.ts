// FILE: lib/qr.ts
import QRCode from "qrcode";

/**
 * input текстээс PNG Data URL үүсгэнэ
 * return: "data:image/png;base64,...."
 */
export async function toQrPngDataUrl(input: string): Promise<string> {
  const text = (input || "").trim();
  if (!text) throw new Error("toQrPngDataUrl: input is empty");

  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    type: "image/png",
  });
}