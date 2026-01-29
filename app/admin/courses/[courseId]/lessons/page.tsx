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
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Lesson = {
  id: string;
  title: string;
  order: number;
  durationSec?: number;
  isFreePreview: boolean;
  isPublished: boolean;
  videoPath?: string;
  video?: {
    storagePath: string;
    downloadUrl?: string;
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
  videoPath: string; // optional болж байна (upload хийвэл автоматаар fill)
  order: number | string;
  durationSec: number | string;
  isFreePreview: boolean;
  isPublished: boolean;
};

const emptyForm: FormState = {
  title: "",
  videoPath: "",
  order: 1,
  durationSec: "",
  isFreePreview: false,
  isPublished: true,
};

function makeUploadId() {
  // UUID байвал сайн, байхгүй бол Date.now ашиглана
  // (Chrome/Edge дээр crypto.randomUUID байдаг)
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return String(Date.now());
}

export default function AdminLessonsPage() {
  const params = useParams();
  const courseId = (params?.courseId as string) || "";
  const router = useRouter();

  const { user, loading, role } = useAuth();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [lastUploadedPath, setLastUploadedPath] = useState<string>("");

  // ✅ хамгаалалт: admin биш бол буцаана
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

  // ✅ courseId байхгүй үед ref үүсгэхгүй
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
    setForm(emptyForm);
    setEditingId(null);
    setSelectedFile(null);
    setUploading(false);
    setUploadPct(0);
    setLastUploadedPath("");
  };

  const onSubmit = async () => {
    if (!lessonsRef) return;

    const title = (form.title || "").trim();
    const orderNum = Number(form.order);
    const durationNum =
      form.durationSec === "" || form.durationSec == null
        ? undefined
        : Number(form.durationSec);

    // ✅ videoPath-ийг заавал шаардахгүй болголоо
    // - file upload хийсэн бол автоматаар орно
    // - эсвэл гараар path өгч болно
    const videoPath = (form.videoPath || "").trim();

    if (!title) return alert("Title заавал!");
    if (!Number.isFinite(orderNum))
      return alert("Order тоо байх ёстой!");
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

      if (durationNum !== undefined) payload.durationSec = durationNum;
      if (videoPath) payload.videoPath = videoPath;

      if (!editingId) {
        // ✅ create (Firestore auto id)
        await addDoc(lessonsRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        // ✅ update
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
      videoPath: (l.videoPath ?? l.video?.storagePath ?? "") as string,
      order: l.order ?? 1,
      durationSec: l.durationSec ?? "",
      isFreePreview: !!l.isFreePreview,
      isPublished: !!l.isPublished,
    });
    setSelectedFile(null);
    setUploadPct(0);
    setLastUploadedPath("");
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

  // ✅ MP4 Upload (lessonId хэрэгтэй тул Edit горимд ажиллуулна)
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
      // Зарим mp4 дээр type хоосон байдаг тохиолдол бий — тэгвэл нэрээр нь зөвшөөрч болно
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

      const url = await getDownloadURL(task.snapshot.ref);

      // ✅ Firestore дээр стандарт бичилт
      await updateDoc(doc(lessonsRef, editingId), {
        videoPath: storagePath, // backward compatible
        video: {
          storagePath,
          downloadUrl: url,
          contentType: task.snapshot.metadata?.contentType || "video/mp4",
          size: task.snapshot.totalBytes,
          originalName: selectedFile.name,
          uploadedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      // UI дээр form.videoPath автоматаар fill
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button
        onClick={() => router.push("/admin")}
        className="mb-4 text-sm text-white/60 hover:text-white"
      >
        ← Admin буцах
      </button>

      <h1 className="text-2xl font-bold">Lessons – {courseId}</h1>
      <p className="mt-2 text-sm text-white/60">
        Course-ийн lesson-уудыг энд нэмнэ/засна.
      </p>

      {/* FORM */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Lesson title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              placeholder="Хичээл 1 — Танилцуулга"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">
              VideoPath (Storage path) — (Upload хийвэл автоматаар бөглөнө)
            </label>
            <input
              value={form.videoPath}
              onChange={(e) => setForm((p) => ({ ...p, videoPath: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              placeholder={`videos/courses/${courseId}/lessons/<lessonId>/<uploadId>.mp4`}
            />
            <div className="mt-1 text-xs text-white/50">
              Энэ нь Storage дээрх зам. (URL биш, path байвал clean)
            </div>
          </div>

          {/* UPLOAD BOX */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-white/80">MP4 Upload (Storage)</div>
            <div className="mt-1 text-xs text-white/50">
              Upload хийхийн тулд <b>Edit</b> горимд (lessonId байгаа үед) ажиллана.
            </div>

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="file"
                accept="video/mp4"
                disabled={uploading || busy}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white file:hover:bg-white/15"
              />

              <button
                disabled={uploading || busy}
                onClick={uploadMp4ToLesson}
                className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-50"
              >
                {uploading ? `Uploading… ${uploadPct}%` : "Upload MP4"}
              </button>
            </div>

            {uploading && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-2 bg-white/40" style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            )}

            {lastUploadedPath && (
              <div className="mt-3 text-xs text-emerald-300/80">
                Uploaded ✅ {lastUploadedPath}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-white/70">Order</label>
            <input
              value={form.order}
              onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              placeholder="1"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Duration (sec) optional</label>
            <input
              value={form.durationSec}
              onChange={(e) => setForm((p) => ({ ...p, durationSec: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              placeholder="600"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="free"
              type="checkbox"
              checked={!!form.isFreePreview}
              onChange={(e) => setForm((p) => ({ ...p, isFreePreview: e.target.checked }))}
            />
            <label htmlFor="free" className="text-sm text-white/70">
              isFreePreview (login хийсэн хүн үзнэ)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="pub"
              type="checkbox"
              checked={!!form.isPublished}
              onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
            />
            <label htmlFor="pub" className="text-sm text-white/70">
              isPublished
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy || uploading}
            onClick={onSubmit}
            className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-50"
          >
            {editingId ? "Update" : "Create"}
          </button>

          <button
            disabled={busy || uploading}
            onClick={resetForm}
            className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            Clear
          </button>

          <button
            disabled={busy || uploading}
            onClick={loadLessons}
            className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {editingId && (
          <div className="mt-2 text-xs text-white/50">
            Одоо засаж байгаа lesson id:{" "}
            <span className="text-white/80">{editingId}</span>
          </div>
        )}
      </div>

      {/* LIST */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Lessons</h2>
        {busy && <div className="text-sm text-white/60 mb-2">Ажиллаж байна...</div>}

        <div className="grid gap-3">
          {lessons.map((l) => (
            <div
              key={l.id}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold">
                  {l.order}. {l.title}
                  {!l.isPublished && (
                    <span className="ml-2 text-xs text-white/50">(hidden)</span>
                  )}
                  {l.isFreePreview && (
                    <span className="ml-2 text-xs text-emerald-300/80">(FREE)</span>
                  )}
                </div>

                <div className="text-xs text-white/50">
                  {l.videoPath || l.video?.storagePath || "(no video yet)"}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={busy || uploading}
                  onClick={() => onEdit(l)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  disabled={busy || uploading}
                  onClick={() => onDelete(l.id)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {lessons.length === 0 && !busy && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
              Одоогоор lesson алга.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}