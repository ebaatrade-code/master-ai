"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

const MAX = 2000;
const MAX_IMAGES = 3;
const MAX_MB = 5;

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

// ── Icons ──────────────────────────────────────────────
function IconMail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4.5 6.5h15c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-15c-.83 0-1.5-.67-1.5-1.5V8c0-.83.67-1.5 1.5-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5.2 8.2 12 13.2l6.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconPhone({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6.5 2.8h11c.94 0 1.7.76 1.7 1.7v15c0 .94-.76 1.7-1.7 1.7h-11c-.94 0-1.7-.76-1.7-1.7v-15c0-.94.76-1.7 1.7-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 18.2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconImage({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSend({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowLeft({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWarning({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Shared style tokens ────────────────────────────────
const labelCls = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40";
const fieldWrap = "group relative rounded-2xl border transition-all duration-200";
const iconCls = "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/25";
const inputCls = "h-14 w-full rounded-2xl bg-transparent pl-12 pr-4 text-[15px] font-medium text-black/55 outline-none cursor-not-allowed";
const goldBtn = "inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_4px_16px_rgba(241,196,91,0.3)] transition hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";
const ghostBtn = "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-[13px] font-bold text-black transition hover:bg-black/[0.03] active:translate-y-px disabled:opacity-50";

// ── Component ──────────────────────────────────────────
export default function RequestPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const { user, userDoc, loading } = useAuth();

  const source = useMemo(() => sp.get("source") || "general", [sp]);
  const email = user?.email || "";
  const profilePhone = (userDoc as any)?.phone ? String((userDoc as any).phone) : "";

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const left = MAX - message.length;
  const phoneReady = !!profilePhone?.trim();
  const canSend =
    !!user && phoneReady &&
    message.trim().length > 0 &&
    message.trim().length <= MAX &&
    files.length <= MAX_IMAGES;

  useEffect(() => { setOk(null); setErr(null); }, [message, files.length]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    const imgs = list.filter((f) => f.type.startsWith("image/"));
    if (imgs.length !== list.length) { setErr("Зөвхөн зураг файл сонгоно уу."); return; }
    const combined = [...files, ...imgs].slice(0, MAX_IMAGES);
    for (const f of combined) {
      if (f.size / (1024 * 1024) > MAX_MB) { setErr(`"${f.name}" файл ${MAX_MB}MB-с хэтэрчээ.`); return; }
    }
    setFiles(combined);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  async function uploadImages(uid: string) {
    if (!files.length) return { urls: [] as string[], paths: [] as string[] };
    const key = `${uid}_${Date.now()}`;
    const urls: string[] = [], paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `supportRequests/${key}/${i + 1}_${safeFileName(f.name)}`;
      const r = ref(storage, path);
      await uploadBytes(r, f, { contentType: f.type });
      urls.push(await getDownloadURL(r));
      paths.push(path);
    }
    return { urls, paths };
  }

  async function submit() {
    setOk(null); setErr(null);
    if (loading) return;
    if (!user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`${pathname}?${sp.toString()}`)}`);
      return;
    }
    if (!phoneReady) { setErr("Утасны дугаараа профайл дээрээ нэмээд дараа нь илгээнэ үү."); return; }
    const msg = message.trim();
    if (!msg) { setErr("Хүсэлтийн текстээ бичнэ үү."); return; }
    if (msg.length > MAX) { setErr(`Хэт урт байна. ${MAX} тэмдэгтээс хэтрэхгүй.`); return; }
    if (files.length > MAX_IMAGES) { setErr(`Хамгийн ихдээ ${MAX_IMAGES} зураг хавсаргана уу.`); return; }
    setSending(true);
    try {
      const up = await uploadImages(user.uid);
      await addDoc(collection(db, "supportRequests"), {
        uid: user.uid,
        email: (user.email || "").trim() || null,
        phone: profilePhone.trim(),
        message: msg,
        status: "OPEN",
        adminNote: null,
        imageUrls: up.urls,
        imagePaths: up.paths,
        createdAt: serverTimestamp(),
        handledAt: null,
        updatedAt: null,
      });
      setOk("Амжилттай илгээлээ! Админ удахгүй шалгана.");
      setMessage("");
      setFiles([]);
    } catch (e: any) {
      setErr(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8 md:py-14">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-[30px] font-extrabold tracking-tight text-black md:text-[38px]">
            Хүсэлт илгээх
          </h1>
          <p className="mt-2 text-[14px] text-black/50">
            Асуудал, санал хүсэлтээ бичээд илгээнэ үү.
          </p>
        </div>

        {/* ── Not logged in ── */}
        {!loading && !user && (
          <div className="mb-6 flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5">
            <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-amber-900">Нэвтрэх шаардлагатай</p>
              <p className="mt-1 text-[13px] text-amber-700">Хүсэлт илгээхийн тулд эхлээд нэвтэрнэ үү.</p>
              <button
                onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(`${pathname}?${sp.toString()}`)}`)}
                className={cn(goldBtn, "mt-3")}
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
              >
                Нэвтрэх
              </button>
            </div>
          </div>
        )}

        {/* ── No phone ── */}
        {!loading && user && !phoneReady && (
          <div className="mb-6 flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5">
            <IconWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-amber-900">Утасны дугаар байхгүй байна</p>
              <p className="mt-1 text-[13px] text-amber-700">
                Хүсэлт илгээхийн тулд профайл дээрээ утасны дугаараа нэмнэ үү.
              </p>
              <button
                onClick={() => router.push("/profile")}
                className={cn(goldBtn, "mt-3")}
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
              >
                Профайл руу очих
              </button>
            </div>
          </div>
        )}

        {/* ── Main card ── */}
        <section className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.07)]">

          {/* Card header */}
          <div className="border-b border-black/8 px-6 py-5 md:px-8 md:py-6">
            <p className="text-[18px] font-bold tracking-tight text-black">Мэдээлэл оруулах</p>
            <p className="mt-0.5 text-[13px] text-black/40">Доорх талбаруудыг бөглөөд хүсэлтээ илгээнэ үү.</p>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8">
            <div className="grid gap-5 md:grid-cols-2">

              {/* Gmail */}
              <div>
                <label className={labelCls}>Gmail</label>
                <div className={cn(fieldWrap, "border-black/8 bg-black/[0.02]")}>
                  <IconMail className={iconCls} />
                  <input className={inputCls} value={email} readOnly disabled placeholder="example@gmail.com" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/35">
                    🔒 Автомат
                  </span>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>Утасны дугаар</label>
                <div className={cn(fieldWrap, "border-black/8 bg-black/[0.02]")}>
                  <IconPhone className={iconCls} />
                  <input className={inputCls} value={profilePhone} readOnly disabled placeholder="99998888" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/35">
                    🔒 Профайлаас
                  </span>
                </div>
              </div>

              {/* Message — full width */}
              <div className="md:col-span-2">
                <label className={labelCls}>Хүсэлтийн текст</label>
                <div className={cn(
                  "rounded-2xl border transition-all duration-200",
                  "border-black/12 focus-within:border-[#F1C45B] focus-within:shadow-[0_0_0_3px_rgba(241,196,91,0.14)]"
                )}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder="Асуудлаа дэлгэрэнгүй бичнэ үү..."
                    className="w-full resize-none rounded-2xl bg-white px-4 py-4 text-[15px] font-medium text-black placeholder:text-black/25 outline-none"
                  />
                </div>
                <div className={cn(
                  "mt-2 text-right text-[12px] font-medium",
                  left < 0 ? "text-red-500" : left < 200 ? "text-amber-500" : "text-black/30"
                )}>
                  {left} тэмдэгт үлдлээ
                </div>
              </div>

              {/* Image upload — full width */}
              <div className="md:col-span-2">
                <label className={labelCls}>Зураг хавсаргах (0–{MAX_IMAGES})</label>
                <div className="rounded-2xl border border-black/10 bg-black/[0.01] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/12 bg-white px-5 py-2.5 text-[13px] font-bold text-black transition hover:bg-black/[0.03] active:translate-y-px",
                      (sending || files.length >= MAX_IMAGES) && "cursor-not-allowed opacity-40"
                    )}>
                      <IconImage className="h-4 w-4" />
                      Зураг сонгох
                      <input
                        type="file" accept="image/*" multiple onChange={onPickFiles}
                        className="hidden"
                        disabled={sending || files.length >= MAX_IMAGES}
                      />
                    </label>
                    <span className="text-[13px] text-black/40">
                      {files.length > 0 ? `${files.length}/${MAX_IMAGES} зураг сонгосон` : "Зураг сонгоогүй"}
                    </span>
                    <span className="ml-auto text-[12px] text-black/30">1 зураг {MAX_MB}MB-с бага</span>
                  </div>

                  {/* Image previews */}
                  {files.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {files.map((f, i) => (
                        <div
                          key={`${f.name}_${i}`}
                          className="flex items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                              <IconImage className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-black">{f.name}</p>
                              <p className="text-[11px] text-black/35">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            disabled={sending}
                            aria-label="Файл устгах"
                            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/8 bg-white text-black/40 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Feedback messages */}
            {err && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-800">
                <span className="text-red-500">✕</span>
                {err}
              </div>
            )}
            {ok && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                <IconCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                {ok}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={submit}
                disabled={!canSend || sending}
                className={goldBtn}
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
              >
                {sending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Илгээж байна...
                  </>
                ) : (
                  <>
                    <IconSend className="h-4 w-4" />
                    Илгээх
                  </>
                )}
              </button>

              <button
                onClick={() => router.back()}
                disabled={sending}
                className={ghostBtn}
              >
                <IconArrowLeft className="h-4 w-4" />
                Буцах
              </button>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}
