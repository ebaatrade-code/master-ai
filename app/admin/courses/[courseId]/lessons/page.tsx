"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Lesson = {
  id: string;
  title: string;
  description?: string;
  order: number;
  durationSec?: number;
  isFreePreview: boolean;
  isPublished: boolean;
  videoPath?: string;
  video?: {
    storagePath: string;
    contentType: string;
    size: number;
    uploadedAt?: any;
    originalName?: string;
  };
  createdAt?: any;
  updatedAt?: any;
};

type FormState = {
  title: string;
  description: string;
  videoPath: string;
  order: number | string;
  durationSec: number | string;
  isFreePreview: boolean;
  isPublished: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  videoPath: "",
  order: 1,
  durationSec: "",
  isFreePreview: false,
  isPublished: true,
};

function makeUploadId() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return String(Date.now());
}

function getMp4DurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.remove();
      };

      video.onloadedmetadata = () => {
        const d = Number.isFinite(video.duration) ? video.duration : 0;
        cleanup();
        resolve(Math.max(0, Math.round(d)));
      };

      video.onerror = () => {
        cleanup();
        reject(new Error("Failed to load video metadata"));
      };
    } catch (e) {
      reject(e);
    }
  });
}

/* ── Inline SVG Icons ── */
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconVideo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function formatDuration(sec?: number) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AdminLessonsPage() {
  const params = useParams();
  const courseId = (params?.courseId as string) || "";
  const router = useRouter();

  const { user, loading, role } = useAuth();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [busy, setBusy] = useState(false);

  // Next available order number
  const nextOrder = useMemo(() => {
    if (!lessons.length) return 1;
    return Math.max(...lessons.map((l) => l.order ?? 0)) + 1;
  }, [lessons]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [lastUploadedPath, setLastUploadedPath] = useState<string>("");

  const [durationAuto, setDurationAuto] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(
          `/admin/courses/${courseId}/lessons`
        )}`
      );
      return;
    }
    if (role !== "admin") {
      router.replace(`/`);
      return;
    }
  }, [loading, user, role, router, courseId]);

  const lessonsRef = useMemo(() => {
    if (!courseId) return null;
    return collection(db, "courses", courseId, "lessons");
  }, [courseId]);

  const loadLessons = async () => {
    if (!lessonsRef) return;
    setBusy(true);
    try {
      const q = query(lessonsRef, orderBy("order", "asc"));
      const snap = await getDocs(q);
      const list: Lesson[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setLessons(list);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;
    if (!lessonsRef) return;
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role, lessonsRef]);

  const resetForm = () => {
    setForm({ ...emptyForm, order: nextOrder });
    setEditingId(null);
    setSelectedFile(null);
    setUploading(false);
    setUploadPct(0);
    setLastUploadedPath("");
    setDurationAuto(false);
  };

  // Auto-update default order when not editing and lessons load
  useEffect(() => {
    if (!editingId) {
      setForm((p) => ({ ...p, order: nextOrder }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextOrder]);

  const reorderLesson = async (lessonId: string, direction: "up" | "down") => {
    if (!lessonsRef) return;
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;

    const a = lessons[idx];
    const b = lessons[swapIdx];

    setBusy(true);
    try {
      await Promise.all([
        updateDoc(doc(lessonsRef, a.id), { order: b.order, updatedAt: serverTimestamp() }),
        updateDoc(doc(lessonsRef, b.id), { order: a.order, updatedAt: serverTimestamp() }),
      ]);
      await loadLessons();
    } catch (e: any) {
      alert(e?.message || "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!lessonsRef) return;

    const title = (form.title || "").trim();
    const description = (form.description ?? "").trim();
    const orderNum = Number(form.order);
    const durationNum =
      form.durationSec === "" || form.durationSec == null
        ? undefined
        : Number(form.durationSec);

    const videoPath = (form.videoPath || "").trim();

    if (!title) return alert("Title заавал!");
    if (!Number.isFinite(orderNum)) return alert("Order тоо байх ёстой!");
    if (durationNum !== undefined && !Number.isFinite(durationNum))
      return alert("durationSec буруу байна!");

    setBusy(true);
    try {
      const payload: any = {
        title,
        order: orderNum,
        isFreePreview: !!form.isFreePreview,
        isPublished: !!form.isPublished,
        updatedAt: serverTimestamp(),
      };

      payload.description = description;

      if (durationNum !== undefined) payload.durationSec = durationNum;
      if (videoPath) payload.videoPath = videoPath;

      if (!editingId) {
        await addDoc(lessonsRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(lessonsRef, editingId), payload);
      }

      await loadLessons();
      resetForm();
      alert("OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (l: Lesson) => {
    setEditingId(l.id);
    setForm({
      title: l.title ?? "",
      description: (l.description ?? "") as string,
      videoPath: (l.videoPath ?? l.video?.storagePath ?? "") as string,
      order: l.order ?? 1,
      durationSec: l.durationSec ?? "",
      isFreePreview: !!l.isFreePreview,
      isPublished: !!l.isPublished,
    });
    setSelectedFile(null);
    setUploadPct(0);
    setLastUploadedPath("");
    setDurationAuto(false);
  };

  const onDelete = async (id: string) => {
    if (!lessonsRef) return;
    if (!confirm("Lesson устгах уу?")) return;

    setBusy(true);
    try {
      await deleteDoc(doc(lessonsRef, id));
      await loadLessons();
      if (editingId === id) resetForm();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Устгах үед алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const uploadMp4ToLesson = async () => {
    if (!lessonsRef) return;
    if (!editingId) {
      alert("Эхлээд lesson-ээ Create хийгээд, дараа нь Edit дарж байж Upload хийнэ.");
      return;
    }
    if (!selectedFile) {
      alert("MP4 файлаа сонго!");
      return;
    }
    if (!selectedFile.type.includes("mp4")) {
      const okByName = selectedFile.name.toLowerCase().endsWith(".mp4");
      if (!okByName) return alert("Зөвхөн .mp4 файл сонго!");
    }

    const uploadId = makeUploadId();
    const storagePath = `videos/courses/${courseId}/lessons/${editingId}/${uploadId}.mp4`;

    setUploading(true);
    setUploadPct(0);
    setLastUploadedPath("");

    try {
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, selectedFile);

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setUploadPct(pct);
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const durationNum =
        form.durationSec === "" || form.durationSec == null
          ? undefined
          : Number(form.durationSec);

      const updatePayload: any = {
        videoPath: storagePath,
        video: {
          storagePath,
          contentType: task.snapshot.metadata?.contentType || "video/mp4",
          size: task.snapshot.totalBytes,
          originalName: selectedFile.name,
          uploadedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      };

      if (durationNum !== undefined && Number.isFinite(durationNum)) {
        updatePayload.durationSec = durationNum;
      }

      await updateDoc(doc(lessonsRef, editingId), updatePayload);

      setForm((p) => ({ ...p, videoPath: storagePath }));
      setLastUploadedPath(storagePath);

      await loadLessons();
      alert("MP4 Upload OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload дээр алдаа гарлаа");
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setUploadPct(0);
    }
  };

  if (loading || !user) return null;
  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-[880px] px-5 pb-20 pt-10">

        {/* ── Back + Header ── */}
        <button
          onClick={() => router.push("/admin")}
          className="mb-5 flex items-center gap-1.5 text-sm font-medium text-neutral-400 transition hover:text-neutral-700"
        >
          <IconBack /> Admin буцах
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Lessons</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[12px] text-neutral-400">
              {courseId}
            </code>
            <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {lessons.length} хичээл
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-400">
            Course-ийн lesson-уудыг энд нэмнэ/засна.
          </p>
        </div>

        {/* ══════════════════════════════════════
           LESSON FORM
           ══════════════════════════════════════ */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* form header */}
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-neutral-800">
                  {editingId ? "Хичээл засах" : "Шинэ хичээл нэмэх"}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {editingId ? (
                    <>
                      Засч байгаа ID:{" "}
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">
                        {editingId}
                      </code>
                    </>
                  ) : (
                    "Firestore дээр шинэ lesson үүсгэнэ."
                  )}
                </p>
              </div>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
                >
                  Цуцлах
                </button>
              )}
            </div>
          </div>

          {/* form body */}
          <div className="space-y-5 p-6">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                Lesson title
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Хичээл 1 — Танилцуулга"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                Lesson description (тайлбар)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={5}
                placeholder={`Тайлбар бичнэ... (Enter дарвал шинэ мөр)\nLink оруулж болно: https://example.com`}
                className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
              <p className="mt-1 text-[11px] text-neutral-300">
                Enter → шинэ мөр хадгалагдана. (Хэрэглэгчийн тал дээр line break зөв харагдана.)
              </p>
            </div>

            {/* Video Path */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                VideoPath (Storage path)
              </label>
              <input
                value={form.videoPath}
                onChange={(e) => setForm((p) => ({ ...p, videoPath: e.target.value }))}
                placeholder={`videos/courses/${courseId}/lessons/<lessonId>/<uploadId>.mp4`}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
              <p className="mt-1 text-[11px] text-neutral-300">
                Upload хийвэл автоматаар бөглөнө. Storage дээрх зам (URL биш, path).
              </p>
            </div>

            {/* ── MP4 Upload Section ── */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <IconVideo />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-700">MP4 Upload (Storage)</div>
                  <div className="text-[11px] text-neutral-400">
                    Edit горимд (lessonId байгаа үед) ажиллана
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <label className="cursor-pointer rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50">
                  <span className="flex items-center gap-2">
                    <IconPlay />
                    {selectedFile ? selectedFile.name : "MP4 файл сонгох"}
                  </span>
                  <input
                    type="file"
                    accept="video/mp4"
                    disabled={uploading || busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);

                      if (!file) {
                        setForm((p) => ({ ...p, durationSec: "" }));
                        setDurationAuto(false);
                        return;
                      }

                      try {
                        const sec = await getMp4DurationSeconds(file);
                        setForm((p) => ({ ...p, durationSec: sec }));
                        setDurationAuto(true);
                      } catch {
                        setDurationAuto(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  disabled={uploading || busy}
                  onClick={uploadMp4ToLesson}
                  className="flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
                >
                  <IconUpload />
                  {uploading ? `Uploading… ${uploadPct}%` : "Upload MP4"}
                </button>
              </div>

              {uploading && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-neutral-900 transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              )}

              {lastUploadedPath && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Uploaded: <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px]">{lastUploadedPath}</code>
                </div>
              )}
            </div>

            {/* Order + Duration */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                  Дугаар (Order)
                  {!editingId && (
                    <span className="ml-2 text-[11px] font-normal text-neutral-400">
                      — дараагийн дугаар: {nextOrder}
                    </span>
                  )}
                </label>
                <input
                  value={form.order}
                  onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  placeholder={String(nextOrder)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                />
                <p className="mt-1 text-[11px] text-neutral-300">
                  Дугаар жижиг байх тусам дээр харагдана. Байрыг солихдоо ↑↓ товч ашиглана.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                  Duration (sec) <span className="text-neutral-300">optional</span>
                </label>
                <input
                  value={form.durationSec}
                  onChange={(e) => setForm((p) => ({ ...p, durationSec: e.target.value }))}
                  readOnly={durationAuto}
                  placeholder="600"
                  className={`w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 ${durationAuto ? "bg-neutral-50 text-neutral-500" : ""}`}
                />
                {durationAuto && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    MP4 metadata-с автоматаар бөглөгдсөн
                  </p>
                )}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 transition hover:border-neutral-300">
                <input
                  type="checkbox"
                  checked={!!form.isFreePreview}
                  onChange={(e) => setForm((p) => ({ ...p, isFreePreview: e.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-200"
                />
                <div>
                  <div className="text-sm font-medium text-neutral-700">isFreePreview</div>
                  <div className="text-[11px] text-neutral-400">Login хийсэн хүн үнэгүй үзнэ</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 transition hover:border-neutral-300">
                <input
                  type="checkbox"
                  checked={!!form.isPublished}
                  onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-200"
                />
                <div>
                  <div className="text-sm font-medium text-neutral-700">isPublished</div>
                  <div className="text-[11px] text-neutral-400">Нийтэд харагдах эсэх</div>
                </div>
              </label>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
              <button
                disabled={busy || uploading}
                onClick={onSubmit}
                className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-50"
              >
                {editingId ? "Хадгалах" : "Үүсгэх"}
              </button>

              <button
                disabled={busy || uploading}
                onClick={resetForm}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
              >
                Цэвэрлэх
              </button>

              {busy && (
                <span className="ml-2 flex items-center gap-2 text-sm text-neutral-400">
                  <svg className="h-4 w-4 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ажиллаж байна...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
           LESSON LIST
           ══════════════════════════════════════ */}
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">Lessons</h2>
            <button
              disabled={busy || uploading}
              onClick={loadLessons}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
            >
              <IconRefresh /> Refresh
            </button>
          </div>

          {busy && !lessons.length && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ачааллаж байна...
            </div>
          )}

          <div className="space-y-2">
            {lessons.map((l, idx) => (
              <div
                key={l.id}
                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4 p-4">
                  {/* Left: reorder buttons + order badge + info */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* ↑↓ reorder */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        disabled={busy || uploading || idx === 0}
                        onClick={() => reorderLesson(l.id, "up")}
                        className="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-25 disabled:cursor-not-allowed"
                        title="Дээш"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        disabled={busy || uploading || idx === lessons.length - 1}
                        onClick={() => reorderLesson(l.id, "down")}
                        className="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-25 disabled:cursor-not-allowed"
                        title="Доош"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {/* Sequential position badge */}
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-500">
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-neutral-800 leading-snug">
                          {l.title}
                        </h3>

                        {!l.isPublished && (
                          <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                            <IconEyeOff /> hidden
                          </span>
                        )}
                        {l.isFreePreview && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            FREE
                          </span>
                        )}
                        {l.durationSec ? (
                          <span className="text-[11px] text-neutral-300">
                            {formatDuration(l.durationSec)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 truncate font-mono text-[11px] text-neutral-300">
                        {l.videoPath || l.video?.storagePath || "Видео байхгүй"}
                      </p>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-shrink-0 gap-1.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      disabled={busy || uploading}
                      onClick={() => onEdit(l)}
                      className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
                    >
                      <IconEdit /> Засах
                    </button>
                    <button
                      disabled={busy || uploading}
                      onClick={() => onDelete(l.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <IconTrash /> Устгах
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {lessons.length === 0 && !busy && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
                <div className="text-3xl opacity-30">🎬</div>
                <p className="mt-3 text-sm text-neutral-400">Одоогоор lesson алга</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}