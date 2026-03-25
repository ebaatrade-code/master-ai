"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

/** =========================
 * Types
 * ========================= */
type Course = {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;

  duration?: string;
  durationLabel?: string;
  durationDays?: number;

  shortDescription?: string;
  whoFor?: string[];
  learn?: string[];

  thumbnailUrl?: string;
  isPublished?: boolean;
  createdAt?: any;
  updatedAt?: any;

  thumbnailPath?: string;
  publishedAt?: any;
  notifiedPublishedAt?: any;
};

/** =========================
 * Forms
 * ========================= */
const emptyCourseForm = {
  title: "",
  price: "",
  oldPrice: "",
  duration: "30 хоног",
  shortDescription: "",
  whoForText: "",
  learnText: "",
  thumbnailUrl: "",
  isPublished: true,
};

function isImgFile(file: File) {
  const ok = ["image/jpeg", "image/png", "image/webp"];
  return ok.includes(file.type);
}

function linesToList(input: string): string[] {
  return (input || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(arr?: string[]) {
  return (arr || []).filter(Boolean).join("\n");
}

function parseDurationToDays(input?: string): number | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;

  const num = raw.match(/(\d+)\s*/);
  const n = num ? Number(num[1]) : NaN;

  if (raw.includes("сар")) {
    if (Number.isFinite(n) && n > 0) return n * 30;
    return 30;
  }

  if (raw.includes("хоног") || raw.includes("өдөр") || raw.includes("day")) {
    if (Number.isFinite(n) && n > 0) return n;
  }

  if (Number.isFinite(n) && n > 0) return n;

  return null;
}

async function fileTo16x9Blob(
  file: File,
  opts?: {
    width?: number;
    height?: number;
    quality?: number;
    type?: "image/webp" | "image/jpeg";
  }
) {
  const width = opts?.width ?? 1280;
  const height = opts?.height ?? 720;
  const quality = opts?.quality ?? 0.86;
  const type = opts?.type ?? "image/webp";

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  const targetRatio = width / height;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const srcRatio = srcW / srcH;

  let cropW = srcW;
  let cropH = srcH;

  if (srcRatio > targetRatio) {
    cropW = Math.round(srcH * targetRatio);
    cropH = srcH;
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
  }

  const sx = Math.round((srcW - cropW) / 2);
  const sy = Math.round((srcH - cropH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, width, height);

  try {
    URL.revokeObjectURL(img.src);
  } catch {}

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality
    );
  });

  return blob;
}

async function notifyAllUsersNewCourse(args: { courseId: string; title: string }) {
  const { courseId, title } = args;

  const usersSnap = await getDocs(collection(db, "users"));

  const writes: Promise<any>[] = [];
  usersSnap.forEach((u) => {
    const uid = u.id;

    writes.push(
      addDoc(collection(db, "users", uid, "notifications"), {
        type: "course_added",
         title: ` " ${title} " нэртэй шинэ сургалт нэмэгдлээ 🎉` ,
           body: " Өөрийгөө хөгжүүлэх хүсэлтэй хүн бүхэнд зориулагдсан ",
        courseId,
        href: `/course/${courseId}#buy`,
        createdAt: serverTimestamp(),
        read: false,
      })
    );
  });

  const CHUNK = 300;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await Promise.all(writes.slice(i, i + CHUNK));
  }
}

/* ── Inline SVG Icons ── */
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
const IconArrowRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [busyCourses, setBusyCourses] = useState(false);
  const [courseForm, setCourseForm] = useState<any>(emptyCourseForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [courseThumbFile, setCourseThumbFile] = useState<File | null>(null);
  const [courseThumbUploading, setCourseThumbUploading] = useState(false);
  const [courseThumbPct, setCourseThumbPct] = useState(0);
  const courseThumbPreview = courseThumbFile ? URL.createObjectURL(courseThumbFile) : null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
      return;
    }
    if (role !== "admin") {
      router.replace(`/`);
      return;
    }
  }, [loading, user, role, router]);

  const loadCourses = async () => {
    setBusyCourses(true);
    try {
      const qy = query(collection(db, "courses"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      const list: Course[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setCourses(list);
    } catch (e) {
      console.error(e);
      const snap = await getDocs(collection(db, "courses"));
      const list: Course[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => a.id.localeCompare(b.id));
      setCourses(list);
    } finally {
      setBusyCourses(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;
    loadCourses();
  }, [loading, user, role]);

  const resetCourseForm = () => {
    setCourseForm(emptyCourseForm);
    setEditingCourseId(null);
    setCourseThumbFile(null);
    setCourseThumbPct(0);
    setCourseThumbUploading(false);
  };

  const editCourse = (c: Course) => {
    setEditingCourseId(c.id);
    const durationUi = (c.durationLabel ?? c.duration ?? "30 хоног").trim();
    setCourseForm({
      title: c.title ?? "",
      price: c.price ?? "",
      oldPrice: c.oldPrice ?? "",
      duration: durationUi,
      shortDescription: c.shortDescription ?? "",
      whoForText: listToLines(c.whoFor),
      learnText: listToLines(c.learn),
      thumbnailUrl: c.thumbnailUrl ?? "",
      isPublished: c.isPublished ?? true,
    });
    setCourseThumbFile(null);
    setCourseThumbPct(0);
    setCourseThumbUploading(false);
  };

  const deleteCourse = async (id: string) => {
    if (!confirm(`"${id}" course устгах уу?`)) return;
    setBusyCourses(true);
    try {
      await deleteDoc(doc(db, "courses", id));
      await loadCourses();
      if (editingCourseId === id) resetCourseForm();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Устгах үед алдаа гарлаа");
    } finally {
      setBusyCourses(false);
    }
  };

  const uploadThumbnailForCourse = async (courseId: string) => {
    if (!courseThumbFile) return alert("Thumbnail файл сонго!");
    if (!isImgFile(courseThumbFile)) return alert("Зөвхөн JPG/PNG/WEBP зөвшөөрнө.");
    setCourseThumbUploading(true);
    setCourseThumbPct(0);
    try {
      const thumbBlob = await fileTo16x9Blob(courseThumbFile, {
        width: 1280, height: 720, quality: 0.86, type: "image/webp",
      });
      const path = `thumbnails/courses/${courseId}/thumb_16x9.webp`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, thumbBlob as any, {
        contentType: "image/webp", cacheControl: "public,max-age=3600",
      } as any);
      const url: string = await new Promise((resolve, reject) => {
        task.on("state_changed",
          (snap) => { setCourseThumbPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)); },
          (err) => reject(err),
          async () => { resolve(await getDownloadURL(task.snapshot.ref)); }
        );
      });
      await updateDoc(doc(db, "courses", courseId), {
        thumbnailUrl: url, thumbnailPath: path, updatedAt: serverTimestamp(),
      });
      setCourseForm((p: any) => ({ ...p, thumbnailUrl: url }));
      setCourseThumbFile(null);
      await loadCourses();
      alert("Thumbnail (16:9) upload OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Thumbnail upload дээр алдаа гарлаа");
    } finally {
      setCourseThumbUploading(false);
    }
  };

  const submitCourse = async () => {
    const title = (courseForm.title || "").trim();
    const priceNum = Number(courseForm.price);
    if (!title) return alert("Title заавал!");
    if (!Number.isFinite(priceNum)) return alert("Price тоо байх ёстой!");
    const oldPriceRaw = courseForm.oldPrice === "" || courseForm.oldPrice == null ? undefined : Number(courseForm.oldPrice);
    if (oldPriceRaw !== undefined && !Number.isFinite(oldPriceRaw)) return alert("Old price буруу байна!");
    const oldPriceNum = oldPriceRaw !== undefined && oldPriceRaw > 0 && oldPriceRaw > priceNum ? oldPriceRaw : undefined;
    const durationLabel = (courseForm.duration || "").trim();
    const shortDescription = (courseForm.shortDescription || "").trim();
    const whoFor = linesToList(courseForm.whoForText || "");
    const learn = linesToList(courseForm.learnText || "");
    const nextIsPublished = !!courseForm.isPublished;
    setBusyCourses(true);
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/admin/courses/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          courseId: editingCourseId || undefined,
          title,
          price: priceNum,
          oldPrice: oldPriceNum ?? "",
          durationLabel,
          shortDescription,
          whoFor,
          learn,
          thumbnailUrl: (courseForm.thumbnailUrl || "").trim(),
          isPublished: nextIsPublished,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || "Хадгалахад алдаа гарлаа");
        return;
      }
      const savedId: string = data?.courseId || editingCourseId || "";
      if (!editingCourseId && courseThumbFile && savedId) {
        await uploadThumbnailForCourse(savedId);
      }
      if (!editingCourseId && nextIsPublished && savedId) {
        try {
          await notifyAllUsersNewCourse({ courseId: savedId, title });
        } catch (err) { console.error("notifyAllUsersNewCourse failed:", err); }
      }
      if (editingCourseId && data?.justPublished) {
        try {
          await notifyAllUsersNewCourse({ courseId: editingCourseId, title });
        } catch (err) { console.error("notify on publish failed:", err); }
      }
      await loadCourses();
      if (!editingCourseId) resetCourseForm();
      alert(editingCourseId ? "Updated ✅" : "OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Алдаа гарлаа");
    } finally {
      setBusyCourses(false);
    }
  };

  if (loading || !user) return null;
  if (role !== "admin") return null;

  /* ══════════════════════════════════════════════
     RENDER — Light Premium Theme
     ══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-[880px] px-5 pb-20 pt-10">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Админ</h1>
            <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {courses.length} сургалт
            </span>
          </div>
          <p className="mt-1 text-[13px] text-neutral-400">Course картаа энд удирдана</p>
        </div>

        {/* ══════════════════════════════════════
           COURSE FORM
           ══════════════════════════════════════ */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* form header */}
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-neutral-800">
                  {editingCourseId ? "Сургалт засах" : "Шинэ сургалт нэмэх"}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {editingCourseId ? (
                    <>
                      Засч байгаа ID:{" "}
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">
                        {editingCourseId}
                      </code>
                    </>
                  ) : (
                    "Create хийхэд Firestore өөрөө ID үүсгэнэ."
                  )}
                </p>
              </div>
              {editingCourseId && (
                <button
                  onClick={resetCourseForm}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
                >
                  Цуцлах
                </button>
              )}
            </div>
          </div>

          {/* form body */}
          <div className="space-y-5 p-6">
            {/* Title + Price */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Сургалтын нэр</label>
                <input
                  value={courseForm.title}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, title: e.target.value }))}
                  placeholder="Жишээ: AI контент бүтээх"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Үнэ</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-300">₮</span>
                  <input
                    value={courseForm.price}
                    onChange={(e) => setCourseForm((p: any) => ({ ...p, price: e.target.value }))}
                    placeholder="120000"
                    className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-8 pr-4 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                  />
                </div>
              </div>
            </div>

            {/* Old Price + Duration */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">
                  Хуучин үнэ <span className="text-neutral-300">(заавал биш)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-300">₮</span>
                  <input
                    value={courseForm.oldPrice}
                    onChange={(e) => setCourseForm((p: any) => ({ ...p, oldPrice: e.target.value }))}
                    placeholder="250000"
                    className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-8 pr-4 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-300">Хөнгөлөлттэй үнэ харуулахад ашиглана</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Хугацаа</label>
                <input
                  value={courseForm.duration}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, duration: e.target.value }))}
                  placeholder="30 хоног / 1 сар / 3 сар"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                />
              </div>
            </div>

            {/* Short description */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Course card дээрх богино тайлбар</label>
              <input
                value={courseForm.shortDescription}
                onChange={(e) => setCourseForm((p: any) => ({ ...p, shortDescription: e.target.value }))}
                placeholder="Сургалтын 1-2 өгүүлбэртэй товч тайлбар"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
              <p className="mt-1 text-[11px] text-neutral-300">Card дээр 2 мөрөөр харагдана — хэт урт бичих хэрэггүй</p>
            </div>

            {/* Who for */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Энэ сургалтанд ямар ямар хичээлүүд багтсан бэ?</label>
              <textarea
                value={courseForm.whoForText}
                onChange={(e) => setCourseForm((p: any) => ({ ...p, whoForText: e.target.value }))}
                rows={4}
                placeholder={`Жишээ:\nAI ашиглаж орлого олох зорилготой хүмүүс\nВидео/контент хийж сошиалд өсөх хүсэлтэй\nЮунаас эхлэхээ мэдэхгүй байсан ч системтэй сурах хүмүүс`}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
            </div>

            {/* Learn */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Та энэ сургалтыг авсанаар юу сурах вэ?</label>
              <textarea
                value={courseForm.learnText}
                onChange={(e) => setCourseForm((p: any) => ({ ...p, learnText: e.target.value }))}
                rows={4}
                placeholder={`Жишээ:\nAI-аар зураг/видео/контент хийх workflow\nTool-уудыг зөв хослуулж ашиглах\nReels/Ads-д тохирсон контент бүтэц`}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
            </div>

            {/* Thumbnail URL */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-500">Thumbnail URL</label>
              <input
                value={courseForm.thumbnailUrl}
                onChange={(e) => setCourseForm((p: any) => ({ ...p, thumbnailUrl: e.target.value }))}
                placeholder="https://... (эсвэл upload хийвэл автоматаар бичигдэнэ)"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-300 transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
            </div>

            {/* ── Thumbnail Upload ── */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <IconUpload />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-700">Thumbnail upload</div>
                  <div className="text-[11px] text-neutral-400">JPG/PNG/WEBP · Автоматаар 16:9 (1280×720) болгож хадгална</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50">
                  <span className="flex items-center gap-2">
                    <IconImage />
                    {courseThumbFile ? courseThumbFile.name : "Файл сонгох"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setCourseThumbFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  disabled={!editingCourseId || courseThumbUploading || busyCourses || !courseThumbFile}
                  onClick={() => editingCourseId && uploadThumbnailForCourse(editingCourseId)}
                  className="flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
                  title={!editingCourseId ? "Edit дээр байж upload хийдэг" : ""}
                >
                  <IconUpload />
                  {courseThumbUploading ? `Uploading... ${courseThumbPct}%` : "Upload"}
                </button>
              </div>

              {courseThumbUploading && (
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full bg-neutral-900 transition-all duration-300" style={{ width: `${courseThumbPct}%` }} />
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-100 px-3 py-2 text-[11px] font-medium text-neutral-400">Preview</div>
                  <div className="p-3">
                    {courseThumbPreview ? (
                      <img src={courseThumbPreview} alt="course thumbnail preview" className="aspect-video w-full rounded-lg object-cover" />
                    ) : courseForm.thumbnailUrl ? (
                      <img src={courseForm.thumbnailUrl} alt="course thumbnail" className="aspect-video w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-lg bg-neutral-50 text-neutral-200">
                        <IconImage />
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-100 px-3 py-2 text-[11px] font-medium text-neutral-400">Хадгалагдсан URL</div>
                  <div className="p-3">
                    <p className="break-all font-mono text-[11px] leading-relaxed text-neutral-400">{courseForm.thumbnailUrl || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Visibility Toggle ── */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
              <div className="text-sm font-semibold text-neutral-700">Нийтэд харагдах тохиргоо</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCourseForm((p: any) => ({ ...p, isPublished: true }))}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                    courseForm.isPublished
                      ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                      : "bg-white text-neutral-400 ring-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <IconEye /> Нийтэд харагдах
                </button>

                <button
                  type="button"
                  onClick={() => setCourseForm((p: any) => ({ ...p, isPublished: false }))}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                    !courseForm.isPublished
                      ? "bg-amber-50 text-amber-600 ring-amber-200"
                      : "bg-white text-neutral-400 ring-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <IconEyeOff /> Нийтэд харагдахгүй
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
                • Нийтэд харагдах = бүх хэрэглэгчдэд харагдана + notification явна
                <br />• Нийтэд харагдахгүй = зөвхөн админд харагдана + notification явахгүй
              </p>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
              <button
                disabled={busyCourses}
                onClick={submitCourse}
                className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-50"
              >
                {editingCourseId ? "Хадгалах" : "Үүсгэх"}
              </button>

              <button
                disabled={busyCourses}
                onClick={resetCourseForm}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
              >
                Цэвэрлэх
              </button>

              {busyCourses && (
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
           COURSE LIST
           ══════════════════════════════════════ */}
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-800">Courses</h2>
            <button
              disabled={busyCourses}
              onClick={loadCourses}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
            >
              <IconRefresh /> Refresh
            </button>
          </div>

          {busyCourses && !courses.length && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ачааллаж байна...
            </div>
          )}

          <div className="space-y-3">
            {courses.map((c) => (
              <div
                key={c.id}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Thumbnail */}
                  {c.thumbnailUrl ? (
                    <div className="relative w-full flex-shrink-0 md:w-[220px]">
                      <img src={c.thumbnailUrl} alt="thumb" className="aspect-video w-full object-cover md:h-full md:aspect-auto" />
                      {!c.isPublished && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-500 shadow-sm backdrop-blur-sm">
                          <IconEyeOff /> Нуусан
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex w-full flex-shrink-0 items-center justify-center bg-neutral-50 md:w-[220px]">
                      <div className="flex aspect-video items-center justify-center text-neutral-200 md:aspect-auto md:py-10">
                        <IconImage />
                      </div>
                      {!c.isPublished && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-500 shadow-sm backdrop-blur-sm">
                          <IconEyeOff /> Нуусан
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-1 flex-col justify-between p-4 md:p-5">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold leading-snug text-neutral-800">{c.title}</h3>
                          <div className="mt-1">
                            <code className="break-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{c.id}</code>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 gap-1.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            disabled={busyCourses}
                            onClick={() => editCourse(c)}
                            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50"
                          >
                            <IconEdit /> Засах
                          </button>
                          <button
                            disabled={busyCourses}
                            onClick={() => deleteCourse(c.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <IconTrash /> Устгах
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-lg font-bold tracking-tight text-neutral-900">{c.price}₮</span>
                        {c.oldPrice ? (
                          <span className="text-sm text-neutral-300 line-through">{c.oldPrice}₮</span>
                        ) : null}
                        {c.oldPrice && c.oldPrice > c.price && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            -{Math.round((1 - c.price / c.oldPrice) * 100)}%
                          </span>
                        )}
                        {(c.durationLabel || c.duration) && (
                          <>
                            <span className="text-neutral-200">·</span>
                            <span className="flex items-center gap-1 text-xs text-neutral-400">
                              <IconClock /> {(c.durationLabel || c.duration) as any}
                            </span>
                          </>
                        )}
                        <span className="text-neutral-200">·</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          c.isPublished ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"
                        }`}>
                          {c.isPublished ? <><IconEye /> Нийтэд</> : <><IconEyeOff /> Нуусан</>}
                        </span>
                      </div>

                      {c.shortDescription && (
                        <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">{c.shortDescription}</p>
                      )}
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={() => router.push(`/admin/courses/${c.id}/lessons`)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                      >
                        Lessons <IconArrowRight />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {courses.length === 0 && !busyCourses && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
                <div className="text-3xl opacity-30">📦</div>
                <p className="mt-3 text-sm text-neutral-400">Одоогоор course алга</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}