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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Top Banner тохиргоо</h1>
      <p className="mt-1 text-sm text-white/60">Header-ийн дээр гардаг announcement bar.</p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        {loading ? (
          <div className="text-sm text-white/60">Ачааллаж байна...</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Banner асаах</div>
                <div className="text-xs text-white/60">Enabled бол сайт дээр шууд гарна.</div>
              </div>
              <button
                onClick={() => setEnabled((v) => !v)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  enabled ? "bg-emerald-600/90" : "bg-white/10"
                }`}
              >
                {enabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-white/70">Text</span>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                  placeholder="🔥 48 цагийн хямдрал"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-white/70">Variant</span>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as Variant)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                  >
                    <option value="promo">promo</option>
                    <option value="info">info</option>
                    <option value="success">success</option>
                    <option value="danger">danger</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/70">Cooldown (hours)</span>
                  <input
                    type="number"
                    value={cooldownHours}
                    onChange={(e) => setCooldownHours(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                    min={1}
                  />
                </label>
              </div>

              {/* ✅ Start / End */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-white/70">Start at</span>
                  <input
                    type="datetime-local"
                    value={startAtStr}
                    onChange={(e) => setStartAtStr(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/70">End at</span>
                  <input
                    type="datetime-local"
                    value={endAtStr}
                    onChange={(e) => setEndAtStr(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="dismissible"
                  type="checkbox"
                  checked={dismissible}
                  onChange={(e) => setDismissible(e.target.checked)}
                />
                <label htmlFor="dismissible" className="text-sm text-white/80">
                  Close (✕) товч гаргах
                </label>
              </div>

              <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold">CTA link</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setHrefType("course")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      hrefType === "course" ? "bg-white/20" : "bg-white/10"
                    }`}
                  >
                    Course
                  </button>
                  <button
                    onClick={() => setHrefType("url")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      hrefType === "url" ? "bg-white/20" : "bg-white/10"
                    }`}
                  >
                    URL
                  </button>
                  <button
                    onClick={() => setHrefType("none")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      hrefType === "none" ? "bg-white/20" : "bg-white/10"
                    }`}
                  >
                    None
                  </button>
                </div>

                {hrefType === "course" ? (
                  <div className="mt-3 grid gap-1">
                    <span className="text-xs text-white/70">Course сонгох</span>
                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title ? `${c.title} — (${c.id})` : c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {hrefType === "url" ? (
                  <div className="mt-3 grid gap-1">
                    <span className="text-xs text-white/70">URL</span>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                      placeholder="https://..."
                    />
                  </div>
                ) : null}

                <div className="mt-3 text-xs text-white/60">
                  Preview link: <span className="text-white/90">{previewHref || "-"}</span>
                </div>

                {/* ✅ Pages */}
                <div className="mt-4 grid gap-1">
                  <span className="text-xs text-white/70">
                    Pages (comma separated) — ж: /, /contents, /course/*
                  </span>
                  <input
                    value={pagesStr}
                    onChange={(e) => setPagesStr(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                    placeholder="/, /contents, /course/*"
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={save}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
