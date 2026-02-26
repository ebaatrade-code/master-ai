"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc, // ✅ NEW
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

  // ✅ Duration (new + legacy)
  duration?: string; // legacy: "30 хоног", "1 сар", ...
  durationLabel?: string; // new: UI дээр яг гаргах label
  durationDays?: number; // new: number for expiry calc

  shortDescription?: string;
  whoFor?: string[];
  learn?: string[];

  thumbnailUrl?: string;
  isPublished?: boolean;
  createdAt?: any;
  updatedAt?: any;

  // (optional) extra fields (эвдэхгүй)
  thumbnailPath?: string;
  publishedAt?: any;
  notifiedPublishedAt?: any;
};

type FreeLesson = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  order?: number;
  isPublished?: boolean;
  storagePath?: string;
  videoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
};

/** =========================
 * Forms
 * ========================= */
const emptyCourseForm = {
  title: "",
  price: "",
  oldPrice: "",

  // ✅ Duration input (admin дээр)
  duration: "30 хоног",

  shortDescription: "",
  whoForText: "",
  learnText: "",

  thumbnailUrl: "",
  isPublished: true,
};

const emptyFreeForm = {
  title: "",
  thumbnailUrl: "",
  order: 1,
  isPublished: true,
  storagePath: "",
  videoUrl: "",
};

function isImgFile(file: File) {
  const ok = ["image/jpeg", "image/png", "image/webp"];
  return ok.includes(file.type);
}

/** ✅ textarea-гийн мөр бүрийг list болгоно */
function linesToList(input: string): string[] {
  return (input || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
function listToLines(arr?: string[]) {
  return (arr || []).filter(Boolean).join("\n");
}

/** ✅ NEW: duration string -> days parse */
function parseDurationToDays(input?: string): number | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;

  // "60", "60 хоног"
  const num = raw.match(/(\d+)\s*/);
  const n = num ? Number(num[1]) : NaN;

  // "сар" => 30 өдөр гэж тооцно
  if (raw.includes("сар")) {
    if (Number.isFinite(n) && n > 0) return n * 30;
    return 30;
  }

  // "хоног" / "өдөр"
  if (raw.includes("хоног") || raw.includes("өдөр") || raw.includes("day")) {
    if (Number.isFinite(n) && n > 0) return n;
  }

  // зүгээр "90" мэт
  if (Number.isFinite(n) && n > 0) return n;

  return null;
}

/** ✅ NEW: image-г 16:9 болгож center-crop + resize (1280x720) хийнэ */
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

/** =========================
 * ✅ helper — бүх хэрэглэгчид шинэ COURSE notification явуулах
 * ========================= */
async function notifyAllUsersNewCourse(args: { courseId: string; title: string }) {
  const { courseId, title } = args;

  const usersSnap = await getDocs(collection(db, "users"));

  const writes: Promise<any>[] = [];
  usersSnap.forEach((u) => {
    const uid = u.id;

    writes.push(
      addDoc(collection(db, "users", uid, "notifications"), {
        type: "course_added",
        title: "Course хичээл шинээр нэмэгдлээ 🎉",
        body: `${title} course хичээл нэмэгдлээ.`,
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

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth();

  /** =========================
   * Tabs
   * ========================= */
  const [showFree, setShowFree] = useState(false);

  /** =========================
   * Courses state
   * ========================= */
  const [courses, setCourses] = useState<Course[]>([]);
  const [busyCourses, setBusyCourses] = useState(false);
  const [courseForm, setCourseForm] = useState<any>(emptyCourseForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // ✅ Course thumbnail upload state
  const [courseThumbFile, setCourseThumbFile] = useState<File | null>(null);
  const [courseThumbUploading, setCourseThumbUploading] = useState(false);
  const [courseThumbPct, setCourseThumbPct] = useState(0);
  const courseThumbPreview = courseThumbFile ? URL.createObjectURL(courseThumbFile) : null;

  /** =========================
   * Free lessons state
   * ========================= */
  const [freeLessons, setFreeLessons] = useState<FreeLesson[]>([]);
  const [busyFree, setBusyFree] = useState(false);
  const [freeForm, setFreeForm] = useState<any>(emptyFreeForm);
  const [editingFreeId, setEditingFreeId] = useState<string | null>(null);

  // upload mp4 (free lesson)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // ✅ Free thumbnail upload state
  const [freeThumbFile, setFreeThumbFile] = useState<File | null>(null);
  const [freeThumbUploading, setFreeThumbUploading] = useState(false);
  const [freeThumbPct, setFreeThumbPct] = useState(0);
  const freeThumbPreview = freeThumbFile ? URL.createObjectURL(freeThumbFile) : null;

  /** =========================
   * Auth guard
   * ========================= */
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

  /** =========================
   * Load courses
   * ========================= */
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

  /** =========================
   * Load free lessons
   * ========================= */
  const loadFreeLessons = async () => {
    setBusyFree(true);
    try {
      const qy = query(collection(db, "freeLessons"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      const list: FreeLesson[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setFreeLessons(list);
    } catch (e) {
      console.error(e);
      const snap = await getDocs(collection(db, "freeLessons"));
      const list: FreeLesson[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => a.id.localeCompare(b.id));
      setFreeLessons(list);
    } finally {
      setBusyFree(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;

    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role]);

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "admin") return;

    if (showFree) loadFreeLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFree, loading, user, role]);

  /** =========================
   * Helper: upload image to Storage (for FREE)
   * ========================= */
  const uploadImageToStorage = async (path: string, file: Blob | File, onPct?: (p: number) => void) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file as any);

    const url: string = await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          if (onPct) {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            onPct(pct);
          }
        },
        (err) => reject(err),
        async () => {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    });

    return url;
  };

  /** =========================
   * Course actions
   * ========================= */
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

  /** ✅ Course thumbnail upload (16:9 болгож, нэг path дээр хадгална) */
  const uploadThumbnailForCourse = async (courseId: string) => {
    if (!courseThumbFile) return alert("Thumbnail файл сонго!");
    if (!isImgFile(courseThumbFile)) return alert("Зөвхөн JPG/PNG/WEBP зөвшөөрнө.");

    setCourseThumbUploading(true);
    setCourseThumbPct(0);

    try {
      const thumbBlob = await fileTo16x9Blob(courseThumbFile, {
        width: 1280,
        height: 720,
        quality: 0.86,
        type: "image/webp",
      });

      const path = `thumbnails/courses/${courseId}/thumb_16x9.webp`;
      const storageRef = ref(storage, path);

      const task = uploadBytesResumable(storageRef, thumbBlob as any, {
        contentType: "image/webp",
        cacheControl: "public,max-age=3600",
      } as any);

      const url: string = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setCourseThumbPct(pct);
          },
          (err) => reject(err),
          async () => {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve(downloadUrl);
          }
        );
      });

      await updateDoc(doc(db, "courses", courseId), {
        thumbnailUrl: url,
        thumbnailPath: path,
        updatedAt: serverTimestamp(),
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

    const oldPriceNum =
      courseForm.oldPrice === "" || courseForm.oldPrice == null ? undefined : Number(courseForm.oldPrice);

    if (oldPriceNum !== undefined && !Number.isFinite(oldPriceNum)) {
      return alert("Old price буруу байна!");
    }

    const durationLabel = (courseForm.duration || "").trim();
    const durationDays = parseDurationToDays(durationLabel);

    const shortDescription = (courseForm.shortDescription || "").trim();
    const whoFor = linesToList(courseForm.whoForText || "");
    const learn = linesToList(courseForm.learnText || "");

    const nextIsPublished = !!courseForm.isPublished;

    setBusyCourses(true);
    try {
      const payload: any = {
        title,
        price: priceNum,
        ...(oldPriceNum !== undefined ? { oldPrice: oldPriceNum } : {}),

        duration: durationLabel || null,
        durationLabel: durationLabel || null,
        ...(durationDays && durationDays > 0 ? { durationDays } : {}),

        shortDescription: shortDescription || null,
        whoFor: whoFor.length ? whoFor : null,
        learn: learn.length ? learn : null,

        thumbnailUrl: (courseForm.thumbnailUrl || "").trim() || null,
        isPublished: nextIsPublished,
        updatedAt: serverTimestamp(),
      };

      Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

      if (!editingCourseId) {
        // ✅ CREATE
        const docRef = await addDoc(collection(db, "courses"), {
          ...payload,
          createdAt: serverTimestamp(),
          ...(nextIsPublished ? { publishedAt: serverTimestamp() } : {}),
        });

        if (courseThumbFile) {
          await uploadThumbnailForCourse(docRef.id);
        }

        // ✅ CREATE дээр: зөвхөн нийтэд харагдах бол notification явуулна
        if (nextIsPublished) {
          try {
            await notifyAllUsersNewCourse({ courseId: docRef.id, title });
            await updateDoc(doc(db, "courses", docRef.id), {
              notifiedPublishedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error("notifyAllUsersNewCourse failed:", err);
          }
        }

        await loadCourses();
        resetCourseForm();
        alert("OK ✅");
      } else {
        // ✅ UPDATE
        // 1) өмнөх төлөвийг уншина
        const refDoc = doc(db, "courses", editingCourseId);
        const prevSnap = await getDoc(refDoc);
        const prev = (prevSnap.exists() ? (prevSnap.data() as any) : {}) as any;

        const prevIsPublished = prev?.isPublished === true;
        const prevNotifiedAt = prev?.notifiedPublishedAt ? true : false;

        // 2) update хийнэ
        await updateDoc(refDoc, {
          ...payload,
          // ✅ анх удаа public болгож байгаа бол publishedAt тавина (эвдэхгүй)
          ...(prevIsPublished ? {} : nextIsPublished ? { publishedAt: serverTimestamp() } : {}),
        });

        // 3) Хэрвээ hidden -> published болсон бол notification явуулна
        //    Мөн давхар 1 удаа л явуулахын тулд notifiedPublishedAt шалгана
        if (!prevIsPublished && nextIsPublished && !prevNotifiedAt) {
          try {
            await notifyAllUsersNewCourse({ courseId: editingCourseId, title });
            await updateDoc(refDoc, { notifiedPublishedAt: serverTimestamp() });
          } catch (err) {
            console.error("notify on publish failed:", err);
          }
        }

        await loadCourses();
        alert("Updated ✅");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Алдаа гарлаа");
    } finally {
      setBusyCourses(false);
    }
  };

  /** =========================
   * Free lesson actions (UNCHANGED)
   * ========================= */
  const resetFreeForm = () => {
    setFreeForm(emptyFreeForm);
    setEditingFreeId(null);

    setSelectedFile(null);
    setUploadPct(0);
    setUploading(false);

    setFreeThumbFile(null);
    setFreeThumbPct(0);
    setFreeThumbUploading(false);
  };

  const editFree = (v: FreeLesson) => {
    setEditingFreeId(v.id);
    setFreeForm({
      title: v.title ?? "",
      thumbnailUrl: v.thumbnailUrl ?? "",
      order: v.order ?? 1,
      isPublished: v.isPublished ?? true,
      storagePath: v.storagePath ?? "",
      videoUrl: v.videoUrl ?? "",
    });

    setSelectedFile(null);
    setUploadPct(0);
    setUploading(false);

    setFreeThumbFile(null);
    setFreeThumbPct(0);
    setFreeThumbUploading(false);
  };

  const deleteFree = async (id: string) => {
    if (!confirm(`"${id}" free lesson устгах уу?`)) return;
    setBusyFree(true);
    try {
      await deleteDoc(doc(db, "freeLessons", id));
      await loadFreeLessons();
      if (editingFreeId === id) resetFreeForm();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Устгах үед алдаа гарлаа");
    } finally {
      setBusyFree(false);
    }
  };

  const uploadThumbnailForFree = async () => {
    if (!freeThumbFile) return alert("Thumbnail файл сонго!");
    if (!isImgFile(freeThumbFile)) return alert("Зөвхөн JPG/PNG/WEBP зөвшөөрнө.");
    if (!editingFreeId) return alert("Эхлээд Create (Free) хийж ID үүсгээд thumbnail upload хийнэ.");

    setFreeThumbUploading(true);
    setFreeThumbPct(0);

    try {
      const ext = freeThumbFile.name.split(".").pop() || "jpg";
      const path = `thumbnails/freeLessons/${editingFreeId}/${Date.now()}.${ext}`;
      const url = await uploadImageToStorage(path, freeThumbFile, setFreeThumbPct);

      await updateDoc(doc(db, "freeLessons", editingFreeId), {
        thumbnailUrl: url,
        updatedAt: serverTimestamp(),
      });

      setFreeForm((p: any) => ({ ...p, thumbnailUrl: url }));
      setFreeThumbFile(null);
      await loadFreeLessons();

      alert("Free thumbnail upload OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Thumbnail upload дээр алдаа гарлаа");
    } finally {
      setFreeThumbUploading(false);
    }
  };

  const uploadMp4ToFree = async () => {
    if (!selectedFile) return alert("MP4 файл сонго!");
    if (!editingFreeId) return alert("Эхлээд Free lesson-оо Create (Free) хийж ID үүсгээд upload хийнэ.");

    setUploading(true);
    setUploadPct(0);

    try {
      const ext = selectedFile.name.split(".").pop() || "mp4";
      const path = `videos/freeLessons/${editingFreeId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);

      const task = uploadBytesResumable(storageRef, selectedFile);

      const url: string = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadPct(pct);
          },
          (err) => reject(err),
          async () => {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve(downloadUrl);
          }
        );
      });

      await updateDoc(doc(db, "freeLessons", editingFreeId), {
        storagePath: path,
        videoUrl: url,
        updatedAt: serverTimestamp(),
      });

      setFreeForm((p: any) => ({ ...p, storagePath: path, videoUrl: url }));
      await loadFreeLessons();

      alert("Upload OK ✅");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload дээр алдаа гарлаа");
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const submitFree = async () => {
    const title = (freeForm.title || "").trim();
    const thumb = (freeForm.thumbnailUrl || "").trim();
    const orderNum = Number(freeForm.order);

    if (!title) return alert("Title заавал!");
    if (!Number.isFinite(orderNum)) return alert("Order тоо байх ёстой!");

    setBusyFree(true);
    try {
      const payload: any = {
        title,
        thumbnailUrl: thumb || null,
        order: orderNum,
        isPublished: !!freeForm.isPublished,
        updatedAt: serverTimestamp(),
      };
      Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

      if (!editingFreeId) {
        const docRef = await addDoc(collection(db, "freeLessons"), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        setEditingFreeId(docRef.id);
        setFreeForm((p: any) => ({
          ...p,
          order: orderNum,
          thumbnailUrl: thumb,
          title,
        }));

        await loadFreeLessons();
        alert("Free lesson created ✅ (Одоо thumbnail + MP4 upload хийж болно)");
      } else {
        await updateDoc(doc(db, "freeLessons", editingFreeId), payload);
        await loadFreeLessons();
        alert("Updated ✅");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Алдаа гарлаа");
    } finally {
      setBusyFree(false);
    }
  };

  if (loading || !user) return null;
  if (role !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-black">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* ✅ Tabs */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-black/60">Хэсэг сонгоод ажилла</div>

        <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setShowFree(false)}
            className={[
              "rounded-xl px-4 py-2 text-sm transition",
              !showFree ? "bg-white/15 text-black" : "text-black/70 hover:bg-white/10",
            ].join(" ")}
          >
            COURSE КАРТАА ЭНД НЭМНЭ
          </button>

          <button
            type="button"
            onClick={() => setShowFree(true)}
            className={[
              "rounded-xl px-4 py-2 text-sm transition",
              showFree ? "bg-white/15 text-black" : "text-black/70 hover:bg-white/10",
            ].join(" ")}
          >
            ҮНЭГҮЙ ХИЧЭЭЛ НЭМЭХ
          </button>
        </div>
      </div>

      {/* =========================================================
          ✅ COURSE SECTION
         ========================================================= */}
      {!showFree && (
        <>
          <p className="mt-2 text-sm text-black/60">COURSE КАРТАА ЭНД НЭМНЭ (Auto ID)</p>

          {/* COURSE FORM */}
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/5 p-5">
            <div className="mb-3 text-sm text-black/60">
              {editingCourseId ? (
                <div>
                  Edit хийж байна: <span className="text-black/80">{editingCourseId}</span>
                </div>
              ) : (
                <div>Create хийхэд Firestore өөрөө ID үүсгэнэ.</div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-black/70">Title</label>
                <input
                  value={courseForm.title}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-black/70">Price</label>
                <input
                  value={courseForm.price}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, price: e.target.value }))}
                  placeholder="120000"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-black/70">Old price (optional)</label>
                <input
                  value={courseForm.oldPrice}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, oldPrice: e.target.value }))}
                  placeholder="250000"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              {/* ✅ NEW: duration */}
              <div>
                <label className="text-sm text-black/70">Course хугацаа</label>
                <input
                  value={courseForm.duration}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, duration: e.target.value }))}
                  placeholder="30 хоног / 1 сар / 3 сар"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              {/* ✅ NEW: shortDescription */}
              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Course card дээрх богино тайлбар</label>
                <input
                  value={courseForm.shortDescription}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, shortDescription: e.target.value }))}
                  placeholder="Сургалтын 1-2 өгүүлбэртэй товч тайлбар"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
                <div className="mt-1 text-xs text-black/45">
                  (Card дээр 2 мөрөөр харагдана — хэт урт бичих хэрэггүй)
                </div>
              </div>

              {/* ✅ NEW: whoFor */}
              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Энэ сургалтанд ямар ямар хичээлүүд багтсан бэ?</label>
                <textarea
                  value={courseForm.whoForText}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, whoForText: e.target.value }))}
                  rows={4}
                  placeholder={`Жишээ:\nAI ашиглаж орлого олох зорилготой хүмүүс\nВидео/контент хийж сошиалд өсөх хүсэлтэй\nЮунаас эхлэхээ мэдэхгүй байсан ч системтэй сурах хүмүүс`}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              {/* ✅ NEW: learn */}
              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Та энэ сургалтыг авсанаар юу сурах вэ?</label>
                <textarea
                  value={courseForm.learnText}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, learnText: e.target.value }))}
                  rows={4}
                  placeholder={`Жишээ:\nAI-аар зураг/видео/контент хийх workflow\nTool-уудыг зөв хослуулж ашиглах\nReels/Ads-д тохирсон контент бүтэц`}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Thumbnail URL</label>
                <input
                  value={courseForm.thumbnailUrl}
                  onChange={(e) => setCourseForm((p: any) => ({ ...p, thumbnailUrl: e.target.value }))}
                  placeholder="https://... (эсвэл upload хийвэл автоматаар бичигдэнэ)"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                />
              </div>

              {/* ✅ COURSE THUMB UPLOAD + PREVIEW */}
              <div className="md:col-span-2 rounded-2xl border border-black/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-black/80">Thumbnail upload (Course)</div>
                <div className="mt-1 text-xs text-black/50">
                  JPG/PNG/WEBP. Upload хийхэд автоматаар 16:9 (1280x720) болгож хадгална.
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setCourseThumbFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />

                  <button
                    type="button"
                    disabled={!editingCourseId || courseThumbUploading || busyCourses || !courseThumbFile}
                    onClick={() => editingCourseId && uploadThumbnailForCourse(editingCourseId)}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                    title={!editingCourseId ? "Edit дээр байж upload хийдэг" : ""}
                  >
                    {courseThumbUploading ? `Uploading... ${courseThumbPct}%` : "Upload Thumbnail"}
                  </button>
                </div>

                {/* preview */}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-black/30 p-3">
                    <div className="text-xs text-black/60 mb-2">Preview</div>
                    {courseThumbPreview ? (
                      <img
                        src={courseThumbPreview}
                        alt="course thumbnail preview"
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    ) : courseForm.thumbnailUrl ? (
                      <img
                        src={courseForm.thumbnailUrl}
                        alt="course thumbnail"
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="text-xs text-black/50">Thumbnail байхгүй</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-black/10 bg-black/30 p-3">
                    <div className="text-xs text-black/60 mb-2">Хадгалагдсан URL</div>
                    <div className="text-xs break-all text-black/70">{courseForm.thumbnailUrl || "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ Publish selector (НИЙТЭД ХАРАГДАХ / ХАРАГДАХГҮЙ) */}
<div className="md:col-span-2 mt-2 rounded-2xl border border-black/10 bg-white/5 p-4">
  <div className="text-sm font-semibold text-black/80">Нийтэд харагдах тохиргоо</div>

  <div className="mt-3 flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() => setCourseForm((p: any) => ({ ...p, isPublished: true }))}
      className={[
        "rounded-full px-4 py-2 text-sm font-extrabold ring-1 transition",
        courseForm.isPublished
          ? "bg-emerald-50 text-emerald-700 ring-emerald-300/70"
          : "bg-white text-black ring-black/15 hover:bg-black/[0.04]",
      ].join(" ")}
    >
      Нийтэд харагдах
    </button>

    <button
      type="button"
      onClick={() => setCourseForm((p: any) => ({ ...p, isPublished: false }))}
      className={[
        "rounded-full px-4 py-2 text-sm font-extrabold ring-1 transition",
        !courseForm.isPublished
          ? "bg-amber-50 text-amber-700 ring-amber-300/70"
          : "bg-white text-black ring-black/15 hover:bg-black/[0.04]",
      ].join(" ")}
    >
      Нийтэд харагдахгүй
    </button>
  </div>

  <div className="mt-2 text-xs text-black/55">
    • Нийтэд харагдах = бүх хэрэглэгчдэд харагдана + notification явна
    <br />
    • Нийтэд харагдахгүй = зөвхөн админд харагдана + notification явахгүй
  </div>
</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={busyCourses}
                onClick={submitCourse}
                className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-50"
              >
                {editingCourseId ? "Update" : "Create"}
              </button>

              <button
                disabled={busyCourses}
                onClick={resetCourseForm}
                className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {/* COURSE LIST */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Courses</h2>
              <button
                disabled={busyCourses}
                onClick={loadCourses}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {busyCourses && <div className="text-sm text-black/60">Ажиллаж байна...</div>}

            <div className="grid gap-3">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold break-all">
                      {c.title}
                      {!c.isPublished && <span className="ml-2 text-xs text-black/50">(hidden)</span>}
                    </div>

                    <div className="mt-1 text-xs text-black/40 break-all">id: {c.id}</div>

                    <div className="mt-1 text-sm text-black/70">
                      {c.price}₮{" "}
                      {c.oldPrice ? <span className="line-through text-black/40">{c.oldPrice}₮</span> : null}
                      {c.durationLabel || c.duration ? (
                        <span className="ml-2 text-black/50">• {(c.durationLabel || c.duration) as any}</span>
                      ) : null}
                    </div>

                    {c.shortDescription ? (
                      <div className="mt-2 text-sm text-black/60">{c.shortDescription}</div>
                    ) : null}

                    {c.thumbnailUrl ? (
                      <div className="mt-3 max-w-[360px]">
                        <img
                          src={c.thumbnailUrl}
                          alt="thumb"
                          className="aspect-video w-full rounded-xl border border-black/10 object-cover"
                        />
                      </div>
                    ) : null}

                    <button
                      onClick={() => router.push(`/admin/courses/${c.id}/lessons`)}
                      className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    >
                      Lessons →
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={busyCourses}
                      onClick={() => editCourse(c)}
                      className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busyCourses}
                      onClick={() => deleteCourse(c.id)}
                      className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {courses.length === 0 && !busyCourses && (
                <div className="rounded-2xl border border-black/10 bg-white/5 p-6 text-black/70">
                  Одоогоор course алга.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* =========================================================
          ✅ FREE LESSONS SECTION (UNCHANGED)
         ========================================================= */}
      {showFree && (
        <>
          <p className="mt-2 text-sm text-black/60">
            ҮНЭГҮЙ ХИЧЭЭЛ НЭМЭХ (Home дээр “ҮНЭГҮЙ ХИЧЭЭЛҮҮД” хэсэгт шууд гарна)
          </p>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white/5 p-5">
            <div className="mb-3 text-sm text-black/60">
              {editingFreeId ? (
                <div>
                  Edit хийж байна: <span className="text-black/80">{editingFreeId}</span>
                </div>
              ) : (
                <div>Эхлээд Create (Free) хийгээд ID үүсгэнэ. Дараа нь Thumbnail + MP4 upload хийнэ.</div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Title</label>
                <input
                  value={freeForm.title}
                  onChange={(e) => setFreeForm((p: any) => ({ ...p, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                  placeholder="Үнэгүй хичээл — Танилцуулга"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-black/70">Thumbnail URL</label>
                <input
                  value={freeForm.thumbnailUrl}
                  onChange={(e) => setFreeForm((p: any) => ({ ...p, thumbnailUrl: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                  placeholder="https://... (эсвэл upload хийвэл автоматаар бичигдэнэ)"
                />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-black/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-black/80">Thumbnail (Зураг Upload)</div>
                <div className="mt-1 text-xs text-black/50">
                  JPG/PNG/WEBP. Upload хийвэл Firestore-ийн thumbnailUrl автоматаар шинэчлэгдэнэ.
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setFreeThumbFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />

                  <button
                    type="button"
                    disabled={freeThumbUploading || busyFree || !freeThumbFile}
                    onClick={uploadThumbnailForFree}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {freeThumbUploading ? `Uploading... ${freeThumbPct}%` : "Upload Thumbnail"}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-black/30 p-3">
                    <div className="text-xs text-black/60 mb-2">Preview</div>
                    {freeThumbPreview ? (
                      <img
                        src={freeThumbPreview}
                        alt="free thumbnail preview"
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    ) : freeForm.thumbnailUrl ? (
                      <img
                        src={freeForm.thumbnailUrl}
                        alt="free thumbnail"
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="text-xs text-black/50">Thumbnail байхгүй</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-black/10 bg-black/30 p-3">
                    <div className="text-xs text-black/60 mb-2">Хадгалагдсан URL</div>
                    <div className="text-xs break-all text-black/70">{freeForm.thumbnailUrl || "—"}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-black/70">Order</label>
                <input
                  value={freeForm.order}
                  onChange={(e) => setFreeForm((p: any) => ({ ...p, order: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 outline-none"
                  placeholder="1"
                />
              </div>

              <div className="flex items-center gap-2 pt-7">
                <input
                  id="pubFree"
                  type="checkbox"
                  checked={!!freeForm.isPublished}
                  onChange={(e) => setFreeForm((p: any) => ({ ...p, isPublished: e.target.checked }))}
                />
                <label htmlFor="pubFree" className="text-sm text-black/70">
                  isPublished
                </label>
              </div>

              <div className="md:col-span-2 rounded-2xl border border-black/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-black/80">Video (MP4 Upload)</div>
                <div className="mt-1 text-xs text-black/50">
                  Upload хийсний дараа StoragePath + videoUrl автоматаар бичигдэнэ.
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="video/mp4"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="text-sm"
                  />

                  <button
                    type="button"
                    disabled={uploading || busyFree}
                    onClick={uploadMp4ToFree}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    {uploading ? `Uploading... ${uploadPct}%` : "Upload MP4"}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-black/60">StoragePath (auto)</label>
                    <input
                      value={freeForm.storagePath}
                      readOnly
                      className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 text-xs outline-none"
                      placeholder="videos/freeLessons/<id>/<timestamp>.mp4"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-black/60">VideoUrl (auto)</label>
                    <input
                      value={freeForm.videoUrl}
                      readOnly
                      className="mt-1 w-full rounded-xl border border-black/10 bg-black/40 px-3 py-2 text-xs outline-none"
                      placeholder="https://firebasestorage.googleapis.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={busyFree}
                onClick={submitFree}
                className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-50"
              >
                {editingFreeId ? "Update (Free)" : "Create (Free)"}
              </button>

              <button
                disabled={busyFree}
                onClick={resetFreeForm}
                className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
              >
                Clear
              </button>

              <button
                disabled={busyFree}
                onClick={loadFreeLessons}
                className="rounded-xl bg-white/5 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Free lessons</h2>
            </div>

            {busyFree && <div className="text-sm text-black/60">Ажиллаж байна...</div>}

            <div className="grid gap-3">
              {freeLessons.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold break-all">
                      {v.order ?? 0}. {v.title}
                      {!v.isPublished && <span className="ml-2 text-xs text-black/50">(hidden)</span>}
                    </div>

                    <div className="mt-1 text-xs text-black/40 break-all">id: {v.id}</div>

                    {v.thumbnailUrl ? (
                      <div className="mt-3 max-w-[360px]">
                        <img
                          src={v.thumbnailUrl}
                          alt="thumb"
                          className="aspect-video w-full rounded-xl border border-black/10 object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="mt-2 text-xs text-black/60 break-all">
                      {v.videoUrl ? (
                        <span>videoUrl: {v.videoUrl}</span>
                      ) : (
                        <span className="text-black/50">video байхгүй</span>
                      )}
                    </div>

                    {v.videoUrl ? (
                      <div className="mt-3">
                        <video
                          src={v.videoUrl}
                          controls
                          preload="metadata"
                          className="aspect-video w-full max-w-[520px] rounded-xl bg-black"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={busyFree}
                      onClick={() => editFree(v)}
                      className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busyFree}
                      onClick={() => deleteFree(v.id)}
                      className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {freeLessons.length === 0 && !busyFree && (
                <div className="rounded-2xl border border-black/10 bg-white/5 p-6 text-black/70">
                  Одоогоор free lesson алга.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}