"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

type Variant = "promo" | "info" | "success" | "danger";
type HrefType = "course" | "url" | "none";
type CourseLite = { id: string; title?: string };

function toInputValue(ts?: Timestamp | null) {
  if (!ts) return "";
  const d = new Date(ts.toMillis());
  // datetime-local формат: YYYY-MM-DDTHH:mm
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputValue(v: string) {
  if (!v) return null;
  const ms = new Date(v).getTime();
  if (!Number.isFinite(ms)) return null;
  return Timestamp.fromMillis(ms);
}

export default function AdminBannerPage() {
  const [loading, setLoading] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("🔥 48 цагийн хямдрал");
  const [variant, setVariant] = useState<Variant>("promo");

  const [hrefType, setHrefType] = useState<HrefType>("course");
  const [courseId, setCourseId] = useState<string>("");
  const [url, setUrl] = useState<string>("");

  const [dismissible, setDismissible] = useState(true);
  const [cooldownHours, setCooldownHours] = useState<number>(24);

  // ✅ NEW
  const [startAtStr, setStartAtStr] = useState<string>(""); // datetime-local string
  const [endAtStr, setEndAtStr] = useState<string>("");
  const [pagesStr, setPagesStr] = useState<string>("/, /contents, /course/*");

  const [courses, setCourses] = useState<CourseLite[]>([]);

  const previewHref = useMemo(() => {
    if (hrefType === "none") return "";
    if (hrefType === "course") return courseId ? `/course/${courseId}` : "";
    if (hrefType === "url") return url;
    return "";
  }, [hrefType, courseId, url]);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "siteConfig", "global");
        const snap = await getDoc(ref);
        const data = (snap.data() || {}) as any;

        const b = data?.banner || {};
        setEnabled(!!b.enabled);
        setText(b.text ?? "🔥 48 цагийн хямдрал");
        setVariant((b.variant as Variant) ?? "promo");
        setDismissible(b.dismissible !== false);
        setCooldownHours(Number(b.cooldownHours ?? 24));

        // ✅ start/end
        setStartAtStr(toInputValue(b.startAt ?? null));
        setEndAtStr(toInputValue(b.endAt ?? null));

        // ✅ pages
        const pagesArr: string[] = Array.isArray(b.pages) ? b.pages : [];
        if (pagesArr.length) setPagesStr(pagesArr.join(", "));

        // href normalize
        const h = b.href;
        if (!h) {
          setHrefType("none");
        } else if (typeof h === "string") {
          if (h.startsWith("http")) {
            setHrefType("url");
            setUrl(h);
          } else if (h.startsWith("/course/")) {
            setHrefType("course");
            setCourseId(h.replace("/course/", ""));
          } else {
            setHrefType("url");
            setUrl(h);
          }
        } else if (h.type === "course") {
          setHrefType("course");
          setCourseId(h.courseId || "");
        } else if (h.type === "url") {
          setHrefType("url");
          setUrl(h.url || "");
        } else {
          setHrefType("none");
        }

        // load courses
        const qs = await getDocs(collection(db, "courses"));
        const list: CourseLite[] = qs.docs.map((d) => ({
          id: d.id,
          title: (d.data() as any)?.title,
        }));
        list.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
        setCourses(list);

        if (!courseId && list.length) setCourseId(list[0].id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const ref = doc(db, "siteConfig", "global");

    let href: any = null;
    if (hrefType === "course" && courseId) href = { type: "course", courseId };
    if (hrefType === "url" && url) href = { type: "url", url };
    if (hrefType === "none") href = null;

    const pages = pagesStr
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const startAt = fromInputValue(startAtStr);
    const endAt = fromInputValue(endAtStr);

    await setDoc(
      ref,
      {
        banner: {
          enabled,
          text: text.trim(),
          variant,
          href,
          dismissible,
          cooldownHours: Number(cooldownHours || 24),

          // ✅ NEW
          pages,
          startAt: startAt ?? null,
          endAt: endAt ?? null,
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    alert("Saved ✅");
  }

  // UI Helpers
  const inputBase = "block w-full rounded-lg border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
  const labelBase = "block text-sm font-semibold leading-6 text-gray-900 mb-1";
  const descBase = "text-xs text-gray-500 mb-2";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Top Banner тохиргоо</h1>
          <p className="mt-2 text-sm text-gray-500">
            Сайтын хамгийн дээд хэсэгт (Header-ийн дээр) гарч ирэх мэдэгдлийн мөрийг эндээс удирдана.
          </p>
        </div>

        {/* Main Content */}
        <div className="mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                <span className="text-sm font-medium">Ачааллаж байна...</span>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              
              {/* STATUS TOGGLE */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Баннерийн төлөв</h3>
                  <p className="text-sm text-gray-500">Enabled асаалттай үед сайт дээр шууд харагдана.</p>
                </div>
                <button
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    enabled ? "bg-green-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enabled ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2">
                {/* TEXT INPUT */}
                <div className="sm:col-span-2">
                  <label className={labelBase}>Текст (Message)</label>
                  <p className={descBase}>Баннер дээр гарах гол мессеж</p>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={inputBase}
                    placeholder="🔥 48 цагийн хямдрал..."
                  />
                </div>

                {/* VARIANT */}
                <div>
                  <label className={labelBase}>Өнгөний төрөл (Variant)</label>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as Variant)}
                    className={inputBase}
                  >
                    <option value="promo">Promo (Онцлох)</option>
                    <option value="info">Info (Мэдээлэл)</option>
                    <option value="success">Success (Амжилттай)</option>
                    <option value="danger">Danger (Чухал)</option>
                  </select>
                </div>

                {/* COOLDOWN */}
                <div>
                  <label className={labelBase}>Дахин харуулах хугацаа</label>
                  <p className={descBase}>Хэрэглэгч хаасны дараа (Цагаар)</p>
                  <input
                    type="number"
                    value={cooldownHours}
                    onChange={(e) => setCooldownHours(Number(e.target.value))}
                    className={inputBase}
                    min={1}
                  />
                </div>

                {/* START AT */}
                <div>
                  <label className={labelBase}>Эхлэх хугацаа</label>
                  <input
                    type="datetime-local"
                    value={startAtStr}
                    onChange={(e) => setStartAtStr(e.target.value)}
                    className={inputBase}
                  />
                </div>

                {/* END AT */}
                <div>
                  <label className={labelBase}>Дуусах хугацаа</label>
                  <input
                    type="datetime-local"
                    value={endAtStr}
                    onChange={(e) => setEndAtStr(e.target.value)}
                    className={inputBase}
                  />
                </div>

                {/* PAGES */}
                <div className="sm:col-span-2">
                  <label className={labelBase}>Харагдах хуудаснууд</label>
                  <p className={descBase}>Таслалаар тусгаарлана уу. (Жнь: /, /contents, /course/*)</p>
                  <input
                    value={pagesStr}
                    onChange={(e) => setPagesStr(e.target.value)}
                    className={inputBase}
                    placeholder="/, /contents, /course/*"
                  />
                </div>
              </div>

              <hr className="my-8 border-gray-200" />

              {/* ACTION LINK SECTION */}
              <div>
                <h3 className="text-base font-semibold text-gray-900">Үйлдэл (CTA Link)</h3>
                <p className="mt-1 text-sm text-gray-500 mb-4">
                  Баннер дээр дарахад хаашаа шилжихийг тохируулна.
                </p>

                {/* Link Tabs */}
                <div className="flex w-full max-w-sm rounded-lg bg-gray-100 p-1">
                  {(["course", "url", "none"] as HrefType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setHrefType(type)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-all ${
                        hrefType === type
                          ? "bg-white text-gray-900 shadow"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Link Dynamic Inputs */}
                <div className="mt-5 max-w-md">
                  {hrefType === "course" && (
                    <div>
                      <label className={labelBase}>Курс сонгох</label>
                      <select
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        className={inputBase}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title ? `${c.title} — (${c.id})` : c.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {hrefType === "url" && (
                    <div>
                      <label className={labelBase}>URL холбоос</label>
                      <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className={inputBase}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 border border-gray-100">
                    <span className="font-medium text-gray-900">Preview link:</span>{" "}
                    {previewHref || <span className="text-gray-400 italic">Сонгоогүй байна</span>}
                  </div>
                </div>
              </div>

              <hr className="my-8 border-gray-200" />

              {/* FOOTER ACTIONS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                      <input
                        id="dismissible"
                        type="checkbox"
                        checked={dismissible}
                        onChange={(e) => setDismissible(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="ml-3 text-sm leading-6">
                      <span className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">Close (✕) товч гаргах</span>
                      <p className="text-gray-500">Хэрэглэгч баннерийг хаах боломжтой болно.</p>
                    </div>
                  </div>
                </label>

                <button
                  onClick={save}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-gray-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:scale-95"
                >
                  Хадгалах
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}