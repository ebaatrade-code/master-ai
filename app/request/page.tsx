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

export default function RequestPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const { user, userDoc, loading } = useAuth();

  const source = useMemo(() => sp.get("source") || "general", [sp]);

  // ✅ Gmail: auth email-ээс автоматаар, өөрчилж болохгүй
  const email = user?.email || "";

  // ✅ Phone: profile(userDoc.phone) -оос автоматаар бөглөгдөнө
  const profilePhone = (userDoc as any)?.phone ? String((userDoc as any).phone) : "";

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const left = MAX - message.length;

  // ✅ files validation
  const phoneReady = !!profilePhone?.trim();
  const canSend =
    !!user &&
    phoneReady &&
    message.trim().length > 0 &&
    message.trim().length <= MAX &&
    files.length <= MAX_IMAGES;

  useEffect(() => {
    setOk(null);
    setErr(null);
  }, [message, files.length]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const list = Array.from(e.target.files || []);
    // reset input so re-pick same file works
    e.target.value = "";

    if (!list.length) return;

    // only images, max 3
    const imgs = list.filter((f) => f.type.startsWith("image/"));
    if (imgs.length !== list.length) {
      setErr("Зөвхөн зураг (image) файл сонгоно уу.");
      return;
    }

    const combined = [...files, ...imgs].slice(0, MAX_IMAGES);

    // size check
    for (const f of combined) {
      const mb = f.size / (1024 * 1024);
      if (mb > MAX_MB) {
        setErr(`Зураг хэт том байна: ${f.name}. ${MAX_MB}MB-с бага байх ёстой.`);
        return;
      }
    }

    setFiles(combined);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  async function uploadImages(uid: string) {
    // uploads first -> returns download urls
    if (!files.length) return { urls: [] as string[], paths: [] as string[] };

    const requestKey = `${uid}_${Date.now()}`;
    const urls: string[] = [];
    const paths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `supportRequests/${requestKey}/${i + 1}_${safeFileName(f.name)}`;
      const r = ref(storage, path);
      await uploadBytes(r, f, { contentType: f.type });
      const url = await getDownloadURL(r);
      urls.push(url);
      paths.push(path);
    }

    return { urls, paths };
  }

  async function submit() {
    setOk(null);
    setErr(null);

    if (loading) return;

    // ✅ Must be logged in (for email + profile phone requirement)
    if (!user) {
      const callbackUrl = `${pathname}?${sp.toString()}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (!phoneReady) {
      setErr("Утасны дугаараа профайл дээрээ нэмээд дараа нь хүсэлт илгээнэ үү.");
      return;
    }

    const msg = message.trim();
    if (!msg) {
      setErr("Хүсэлтийн текстээ бичнэ үү.");
      return;
    }
    if (msg.length > MAX) {
      setErr(`Хэт урт байна. ${MAX} тэмдэгтээс хэтрэхгүй.`);
      return;
    }
    if (files.length > MAX_IMAGES) {
      setErr(`Хамгийн ихдээ ${MAX_IMAGES} зураг хавсаргаж болно.`);
      return;
    }

    setSending(true);
    try {
      // ✅ 1) Upload images to Storage first
      const up = await uploadImages(user.uid);

      // ✅ 2) Create Firestore doc once (no user update needed)
      await addDoc(collection(db, "supportRequests"), {
        uid: user.uid,
        email: (user.email || "").trim() || null,
        phone: profilePhone.trim(),
        message: msg,

        status: "OPEN",
        adminNote: null,

        // ✅ attachments
        imageUrls: up.urls,
        imagePaths: up.paths, // admin/debug зорилгоор

        createdAt: serverTimestamp(),
        handledAt: null,
        updatedAt: null,

        // ⚠️ Хэрвээ та source-г Firestore дээр хадгалахыг хүсвэл:
        // source,
      });

      setOk("Амжилттай илгээлээ ✅ Админ удахгүй шалгана.");
      setMessage("");
      setFiles([]);
    } catch (e: any) {
      setErr(e?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-black">Хүсэлт илгээх</h1>
      <p className="mt-1 text-sm text-black">Асуудал, санал хүсэлтээ бичээд илгээнэ үү.</p>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
        {/* ✅ Login required notice */}
        {!loading && !user ? (
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <div className="text-sm text-black">
              Хүсэлт илгээхийн тулд нэвтэрсэн байх шаардлагатай.
            </div>
            <button
              onClick={() => {
                const callbackUrl = `${pathname}?${sp.toString()}`;
                router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
              }}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black border border-black/10 hover:bg-black/[0.02]"
            >
              Нэвтрэх
            </button>
          </div>
        ) : null}

        {/* ✅ Phone required notice */}
        {!loading && user && !phoneReady ? (
          <div className="mb-4 rounded-xl border border-black/10 bg-white p-4">
            <div className="text-sm text-black">
              Хүсэлт илгээхийн тулд <b className="text-black">утасны дугаараа профайл дээрээ</b>{" "}
              заавал хадгалсан байх ёстой.
            </div>
            <button
              onClick={() => router.push("/profile")}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black border border-black/10 hover:bg-black/[0.02]"
            >
              Профайл руу ороод утсаа нэмэх
            </button>
          </div>
        ) : null}

        <div className="grid gap-4">
          {/* Gmail (readonly) */}
          <label className="grid gap-1">
            <span className="text-xs text-black">Gmail</span>
            <input
              value={email}
              readOnly
              disabled
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-black outline-none opacity-50 cursor-not-allowed"
              placeholder="example@gmail.com"
            />
          </label>

          {/* Phone (readonly from profile) */}
          <label className="grid gap-1">
            <span className="text-xs text-black">Утасны дугаар</span>
            <input
              value={profilePhone}
              readOnly
              disabled
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-black outline-none opacity-50 cursor-not-allowed"
              placeholder="99998888"
            />
          </label>

          {/* Message */}
          <label className="grid gap-1">
            <span className="text-xs text-black">Хүсэлтийн текст</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="rounded-xl border border-black/99 bg-white px-2 py-4 text-black outline-none opacity-50"
            
            />
            <div className={cn("text-xs", left < 0 ? "text-red-600" : "text-black")}>
              {left} тэмдэгт үлдлээ
            </div>
          </label>

          {/* ✅ Attach images */}
          <div className="rounded-xl border border-black/10 bg-white p-2">
            <div className="text-sm font-semibold text-black">Зураг хавсаргах (0–3)</div>
            <div className="mt-1 text-xs text-black">
              Зөвхөн зураг файл. 1 зураг {MAX_MB}MB-с бага.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black border border-black/10 hover:bg-black/[0.02]">
                Зураг сонгох
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  className="hidden"
                  disabled={sending || files.length >= MAX_IMAGES}
                />
              </label>

              {files.length ? (
                <div className="text-xs text-black self-center">
                  {files.length}/{MAX_IMAGES} сонгосон
                </div>
              ) : (
                <div className="text-xs text-black self-center">Зураг сонгоогүй</div>
              )}
            </div>

            {files.length ? (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}_${i}`}
                    className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-black">{f.name}</div>
                      <div className="text-xs text-black">
                        {(f.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black border border-black/10 hover:bg-black/[0.02]"
                      disabled={sending}
                    >
                      Устгах
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {err ? <div className="text-sm text-red-600">{err}</div> : null}
          {ok ? <div className="text-sm text-emerald-700">{ok}</div> : null}

          <div className="flex gap-2">
  <button
    onClick={submit}
    disabled={!canSend || sending}
    className={cn(
      "rounded-xl px-4 py-2 text-sm font-semibold text-black",
      "bg-amber-200 border border-amber-400/60 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
    )}
  >
    {sending ? "Илгээж байна..." : "Илгээх"}
  </button>


            <button
              onClick={() => router.back()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black border border-black/10 hover:bg-black/[0.02]"
              disabled={sending}
            >
              Буцах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}