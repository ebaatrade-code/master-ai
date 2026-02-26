"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

/* =========================
   Format helpers
========================= */
function formatISO(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authMethodLabel(m?: string) {
  if (m === "google") return "Google";
  if (m === "email") return "Email";
  return "Unknown";
}

function accountStatusLabel(s?: string) {
  if (s === "suspended") return "Suspended";
  return "Active";
}

function computeRank(purchasedCount: number) {
  if (purchasedCount >= 10) return { name: "Master", level: 4 };
  if (purchasedCount >= 5) return { name: "Pro Learner", level: 3 };
  if (purchasedCount >= 1) return { name: "Beginner+", level: 2 };
  return { name: "Beginner", level: 1 };
}

function computeAccess(purchasedCount: number, role?: string) {
  if (role === "admin") return "Lifetime";
  if (purchasedCount > 0) return "Paid";
  return "Free";
}

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

/* =========================
   Icons (inline)
========================= */
function IconUser({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5c0-2.485-3.582-4.5-8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M6.5 2.8h11c.94 0 1.7.76 1.7 1.7v15c0 .94-.76 1.7-1.7 1.7h-11c-.94 0-1.7-.76-1.7-1.7v-15c0-.94.76-1.7 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 18.2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconMail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4.5 6.5h15c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-15c-.83 0-1.5-.67-1.5-1.5V8c0-.83.67-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5.2 8.2 12 13.2l6.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12.5 6.5 17.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4 20h4l11-11a2.1 2.1 0 0 0 0-3l-1-1a2.1 2.1 0 0 0-3 0L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================
   UI helpers
========================= */
function glowRing(level: number) {
  // ✅ Light theme ring
  if (level >= 4) return "ring-2 ring-black/25";
  if (level >= 3) return "ring-2 ring-black/18";
  if (level >= 2) return "ring-2 ring-black/14";
  return "ring-1 ring-black/12";
}

function levelBadgeText(rankName: string, level: number, roleLabel: string) {
  if (roleLabel === "Admin") return "ADMIN • L∞";
  return `${rankName} • L${level}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, userDoc, loading } = useAuth();

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);

  const [totalCourses, setTotalCourses] = useState<number | null>(null);
  const [fetchingStats, setFetchingStats] = useState(false);

  const purchasedCount = userDoc?.purchasedCourseIds?.length ?? 0;

  const email = useMemo(() => user?.email || userDoc?.email || "", [user?.email, userDoc?.email]);
  const createdAtText = useMemo(() => formatISO(userDoc?.createdAt), [userDoc?.createdAt]);

  const lastLoginText = useMemo(() => {
    const t = user?.metadata?.lastSignInTime || "";
    return formatDateTime(t);
  }, [user?.metadata?.lastSignInTime]);

  const roleLabel = useMemo(() => (userDoc?.role === "admin" ? "Admin" : "Student"), [userDoc?.role]);
  const rank = useMemo(() => computeRank(purchasedCount), [purchasedCount]);
  const accessStatus = useMemo(() => computeAccess(purchasedCount, userDoc?.role), [purchasedCount, userDoc?.role]);

  const progressPercent = useMemo(() => {
    if (!totalCourses || totalCourses <= 0) return 0;
    const p = Math.round((purchasedCount / totalCourses) * 100);
    return Math.max(0, Math.min(100, p));
  }, [purchasedCount, totalCourses]);

  const showToast = (type: "ok" | "err" | "info", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login?callbackUrl=%2Fprofile");
  }, [loading, user, router]);

  useEffect(() => {
    setName(userDoc?.name ?? "");
    setPhone(userDoc?.phone ?? "");
    setAvatarPreview(userDoc?.avatarUrl ?? "");
  }, [userDoc?.name, userDoc?.phone, userDoc?.avatarUrl]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setFetchingStats(true);
      try {
        const snap = await getDocs(collection(db, "courses"));
        setTotalCourses(snap.size);
      } catch (e) {
        console.error(e);
        setTotalCourses(0);
      } finally {
        setFetchingStats(false);
      }
    };
    run();
  }, [user]);

  const onCancel = () => {
    setEditing(false);
    setName(userDoc?.name ?? "");
    setPhone(userDoc?.phone ?? "");
    setAvatarPreview(userDoc?.avatarUrl ?? "");
    showToast("info", "Өөрчлөлтийг цуцаллаа");
  };

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const r = doc(db, "users", user.uid);
      await setDoc(r, { name: name.trim(), phone: phone.trim() }, { merge: true });
      setEditing(false);
      showToast("ok", "Амжилттай хадгаллаа ✅");
    } catch (e: any) {
      console.error(e);
      showToast("err", `❌ Хадгалах алдаа: ${e?.message || "алдаа"}`);
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (file: File) => {
    if (!user) return;

    if (!file.type.startsWith("image/")) return showToast("err", "❌ Зөвхөн зураг сонгоно уу");
    if (file.size > 2 * 1024 * 1024) return showToast("err", "❌ Зураг 2MB-аас бага байх ёстой");

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${user.uid}.${ext}`;
      const r = sRef(storage, path);

      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);

      setAvatarPreview(url);
      await setDoc(doc(db, "users", user.uid), { avatarUrl: url }, { merge: true });

      showToast("ok", "Avatar шинэчлэгдлээ ✅");
    } catch (e: any) {
      console.error(e);
      showToast("err", `❌ Avatar upload алдаа: ${e?.message || "алдаа"}`);
    } finally {
      setAvatarUploading(false);
    }
  };

  /* =========================
     ✅ DESKTOP (LIGHT UI) — Profile only
     - Stroke weight visible
     - Inside background pure white
     - Important text bold
  ========================= */
  const sectionCls = "pt-10 mt-10 border-t border-black/10";

  const h2 = "mt-1 text-xl font-extrabold tracking-tight text-black";

  const card =
    "rounded-3xl border-2 border-black/15 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.12)]";
  const inner =
    "rounded-2xl border-2 border-black/10 bg-white shadow-[0_10px_26px_rgba(0,0,0,0.06)]";

  const labelRow = "mb-2 flex items-center gap-2 text-sm font-bold text-black/75";
  const iconDot =
    "inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-black/[0.03] ring-1 ring-black/12";
  const iconCls = "h-4 w-4 text-black/80";

  const inputWrap =
    "relative rounded-2xl border-2 border-black/12 bg-white ring-1 ring-black/5 focus-within:border-black/30 focus-within:ring-black/10";
  const inputBase =
    "w-full rounded-2xl bg-transparent pl-11 pr-4 py-3.5 text-sm text-black placeholder:text-black/40 outline-none";
  const inputIcon = "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-black/55";
  const inputDisabled = "cursor-not-allowed opacity-80";

  const goldBtn =
    "rounded-full px-5 py-2 text-sm font-extrabold text-black bg-[linear-gradient(135deg,#F4D27A,#F1C45B)] border border-black/10 shadow-[0_16px_40px_rgba(244,210,122,0.22)] hover:brightness-[1.03] active:translate-y-[1px]";
  const ghostBtn =
    "rounded-full px-5 py-2 text-sm font-extrabold border-2 border-black/12 bg-white text-black hover:bg-black/[0.03]";

  // ======== MOBILE helpers (Skool-like) ========
  const mobileHandle = useMemo(() => {
    const base = (name?.trim() || email?.split("@")[0] || user?.uid?.slice(0, 6) || "user").toLowerCase();
    return `@${base.replace(/\s+/g, "-")}`;
  }, [name, email, user?.uid]);

  return (
    <>
      {/* =========================================================
          ✅ MOBILE (unchanged)
          ========================================================= */}
      <div className="md:hidden min-h-[calc(100vh-80px)] bg-white text-black">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-black/10">
          <div className="mx-auto max-w-md px-4 h-12 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="h-9 w-9 rounded-full border border-black/10 bg-white active:scale-[0.98]"
              aria-label="Back"
              title="Back"
            >
              <span className="text-lg leading-none">←</span>
            </button>

            <div className="text-[15px] font-semibold tracking-tight">Profile</div>
            <div className="h-9 w-9" aria-hidden="true" />
          </div>
        </div>

        {toast && (
          <div className="mx-auto max-w-md px-4 pt-4">
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                toast.type === "ok" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-900",
                toast.type === "err" && "border-red-500/20 bg-red-500/10 text-red-900",
                toast.type === "info" && "border-black/10 bg-black/5 text-black/70"
              )}
            >
              <span className="font-semibold">{toast.text}</span>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-md px-4 pb-10">
          <div className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full overflow-hidden border border-black/10 bg-black/5">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl font-extrabold text-black/55">
                      {((name || email || "U").trim()[0] || "U").toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="absolute -right-1 -bottom-1 h-7 min-w-7 px-2 rounded-full bg-black text-white text-[12px] font-semibold flex items-center justify-center border border-black/10">
                  L{rank.level}
                </div>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!editing || avatarUploading}
                  className={cn(
                    "absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-2",
                    editing ? "active:scale-[0.98]" : "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Change avatar"
                  title="Change avatar"
                >
                  <IconPencil className="h-4 w-4 text-black/80" />
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickAvatar(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="mt-3 text-[22px] font-extrabold tracking-tight">{name?.trim() ? name : "PROFILE"}</div>
              <div className="mt-0.5 text-[13px] text-black/55">{mobileHandle}</div>
              <div className="mt-2 text-[14px] text-black/70">{email || "—"}</div>

              <div className="mt-4 w-full space-y-3 text-left">
                <div className="flex items-center gap-3 text-[14px]">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-black/80">Online</span>
                </div>
                <div className="flex items-center gap-3 text-[14px]">
                  <span className="text-[16px]">📅</span>
                  <span className="text-black/80">Joined {createdAtText}</span>
                </div>
              </div>

              <div className="mt-5 w-full grid grid-cols-1 gap-3">
                <Link
                  href="/my-content"
                  className="h-11 rounded-xl bg-[linear-gradient(135deg,#F4D27A,#F1C45B)] text-black font-semibold flex items-center justify-center border border-black/10 active:scale-[0.99]"
                >
                  Үргэлжлүүлэх →
                </Link>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/my-content"
                    className="h-11 rounded-xl border border-black/10 bg-white font-semibold text-[14px] flex items-center justify-center active:scale-[0.99]"
                  >
                    Авсан сургалтын ахиц харах
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="my-5 border-t border-black/10" />

          <div className="grid grid-cols-3 rounded-2xl border border-black/10 overflow-hidden bg-white">
            <div className="py-4 text-center">
              <div className="text-[20px] font-extrabold">{purchasedCount}</div>
              <div className="text-[12px] text-black/55">Courses</div>
            </div>

            <div className="py-4 text-center border-l border-black/10">
              <div className="text-[20px] font-extrabold">{fetchingStats ? "…" : `${progressPercent}%`}</div>
              <div className="text-[12px] text-black/55">Progress</div>
            </div>

            <div className="py-4 text-center border-l border-black/10">
              <div className="text-[20px] font-extrabold">{roleLabel}</div>
              <div className="text-[12px] text-black/55">Role</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex items-center justify-between text-[12px] text-black/60">
              <span className="font-semibold">Нийт ахиц</span>
              <span className="font-semibold text-black/70">{fetchingStats ? "…" : `${progressPercent}%`}</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#F4D27A,rgba(0,0,0,0.75))]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 text-[12px] text-black/55">
              Нийт курс: <span className="font-semibold text-black/80">{totalCourses ?? "…"}</span>
              <span className="mx-2 text-black/20">•</span>
              Access: <span className="font-semibold text-black/80">{accessStatus}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-[12px] text-black/70">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white ring-1 ring-black/10">
                <IconSpark className="h-4 w-4 text-black/80" />
              </span>
              Өнөөдөр 10 минут үзвэл ахиц хамгийн хурдан нэмэгдэнэ.
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 relative">
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-semibold text-black">Хувийн мэдээлэл</div>

              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold active:scale-[0.98]"
                >
                  <IconPencil className="h-4 w-4 text-black/80" />
                  Засах
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    className="h-9 px-3 rounded-full border border-black/10 bg-white text-[13px] font-semibold active:scale-[0.98]"
                  >
                    Цуцлах
                  </button>
                  <button
                    onClick={onSave}
                    disabled={saving}
                    className={cn(
                      "h-9 px-3 rounded-full text-[13px] font-semibold text-black",
                      "bg-[linear-gradient(135deg,#F4D27A,#F1C45B)] border border-black/10",
                      "disabled:opacity-60 active:scale-[0.98]"
                    )}
                  >
                    {saving ? "..." : "Хадгалах"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[12px] font-semibold text-black/60">Нэр / Username</div>
                <div className={cn("mt-1 rounded-xl border border-black/10 bg-white", !editing && "opacity-70")}>
                  <div className="flex items-center gap-2 px-3">
                    <IconUser className="h-4 w-4 text-black/50" />
                    <input
                      className="w-full h-11 outline-none text-[14px] bg-transparent"
                      disabled={!editing}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Жишээ: Tylraaa"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-black/60">Утас</div>
                <div className={cn("mt-1 rounded-xl border border-black/10 bg-white", !editing && "opacity-70")}>
                  <div className="flex items-center gap-2 px-3">
                    <IconPhone className="h-4 w-4 text-black/50" />
                    <input
                      className="w-full h-11 outline-none text-[14px] bg-transparent"
                      disabled={!editing}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Жишээ: 99100000"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[12px] font-semibold text-black/60">Email (read-only)</div>
                <div className="mt-1 rounded-xl border border-black/10 bg-black/5">
                  <div className="flex items-center gap-2 px-3">
                    <IconMail className="h-4 w-4 text-black/50" />
                    <input className="w-full h-11 outline-none text-[14px] bg-transparent" readOnly value={email} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-8" />
        </div>
      </div>

      {/* =========================================================
          ✅ DESKTOP (UPDATED to White stroke UI)
          ========================================================= */}
      <div className="hidden md:block bg-white text-black">
        <div className="min-h-screen bg-white text-black">
          <div className="mx-auto max-w-5xl px-5 py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-black">Профайл</h1>
              </div>
            </div>

            {toast && (
              <div
                className={cn(
                  "mt-6 rounded-2xl border-2 px-4 py-3 text-sm",
                  toast.type === "ok" && "border-emerald-600/20 bg-emerald-500/10 text-emerald-900",
                  toast.type === "err" && "border-red-600/20 bg-red-500/10 text-red-900",
                  toast.type === "info" && "border-black/10 bg-black/5 text-black/70"
                )}
              >
                <span className="font-bold">{toast.text}</span>
              </div>
            )}

            <section className={sectionCls}>
              <div className="flex flex-wrap items-center justify-between gap-3">

                {!editing ? (
                  <button onClick={() => setEditing(true)} className={cn(goldBtn, "inline-flex items-center gap-2")}>
                    <IconPencil className="h-4 w-4 text-black" />
                    Засах
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={onCancel} className={ghostBtn}>
                      Цуцлах
                    </button>
                    <button onClick={onSave} disabled={saving} className={cn(goldBtn, "disabled:opacity-60")}>
                      {saving ? "Хадгалж байна..." : "Хадгалах"}
                    </button>
                  </div>
                )}
              </div>

              <div className={cn("mt-6 p-5 md:p-6", card)}>
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div
                        className={cn(
                          "h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-3xl border-2 border-black/15 bg-white",
                          glowRing(rank.level)
                        )}
                      >
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-3xl font-extrabold text-black/70">
                            {((name || email || "U").trim()[0] || "U").toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <div className="rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-extrabold text-black shadow-[0_12px_30px_rgba(0,0,0,0.10)]">
                          {levelBadgeText(rank.name, rank.level, roleLabel)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={!editing || avatarUploading}
                        className={cn(
                          "absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full border-2 border-black/15 bg-white p-2",
                          editing ? "hover:bg-black/[0.03]" : "opacity-50 cursor-not-allowed"
                        )}
                        title="Зураг солих"
                        aria-label="Зураг солих"
                      >
                        <IconPencil className="h-4 w-4 text-black/85" />
                      </button>

                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onPickAvatar(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-2xl font-extrabold text-black">
                          {name?.trim() ? name : "PROFILE"}
                        </div>

                        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-xs font-extrabold text-black/80">
                          {roleLabel}
                        </span>

                        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-xs font-extrabold text-black/80">
                          {accessStatus}
                        </span>
                      </div>

                      <div className="mt-1 truncate text-sm font-semibold text-black/65">{email || "—"}</div>

                      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 border-black/10 bg-white px-3 py-2 text-xs text-black/75 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.03] ring-1 ring-black/10">
                          <IconSpark className="h-4 w-4 text-black/85" />
                        </span>
                        <span className="font-semibold">Өнөөдөр 10 минут үзвэл</span> ахиц хамгийн хурдан нэмэгдэнэ.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:items-end">
                    <Link href="/my-content" className={cn(goldBtn, "text-center")}>
                      Үргэлжлүүлэх →
                    </Link>

                    <Link href="/my-content" className={cn(ghostBtn, "text-center")}>
                      Авсан сургалтын ахиц харах
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className={cn("p-4", inner)}>
                    <div className="text-xs font-bold text-black/55">Авсан курс</div>
                    <div className="mt-1 text-2xl font-extrabold text-black">{purchasedCount}</div>
                  </div>

                  <div className={cn("p-4", inner)}>
                    <div className="text-xs font-bold text-black/55">Өөрийгөө хөгжүүлж байгаа ахиц</div>
                    <div className="mt-1 text-2xl font-extrabold text-black">
                      {fetchingStats ? "…" : `${progressPercent}%`}
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#F4D27A,rgba(0,0,0,0.85))] shadow-[0_0_22px_rgba(244,210,122,0.22)]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-xs text-black/55">
                      Нийт курс: <span className="font-extrabold text-black">{totalCourses ?? "…"}</span>
                    </div>
                  </div>

                  <div className={cn("p-4", inner)}>
                    <div className="text-xs font-bold text-black/55">Таны түвшин</div>
                    <div className="mt-1 text-2xl font-extrabold text-black">
                      L{rank.level} <span className="text-sm font-bold text-black/55">· {rank.name}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <div>
                  <div className={labelRow}>
                    <span className={iconDot}>
                      <IconUser className={iconCls} />
                    </span>
                    Нэр / Username
                  </div>
                  <div className={cn(inputWrap, !editing && inputDisabled)}>
                    <IconUser className={inputIcon} />
                    <input
                      className={inputBase}
                      disabled={!editing}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Жишээ: Tylraaa"
                    />
                  </div>
                </div>

                <div>
                  <div className={labelRow}>
                    <span className={iconDot}>
                      <IconPhone className={iconCls} />
                    </span>
                    Утас
                  </div>
                  <div className={cn(inputWrap, !editing && inputDisabled)}>
                    <IconPhone className={inputIcon} />
                    <input
                      className={inputBase}
                      disabled={!editing}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Жишээ: 99100000"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className={labelRow}>
                    <span className={iconDot}>
                      <IconMail className={iconCls} />
                    </span>
                    Майл хаяг
                  </div>
                  <div className={cn(inputWrap, "cursor-not-allowed bg-black/[0.02]")}>
                    <IconMail className={inputIcon} />
                    <input className={cn(inputBase, "opacity-95")} readOnly value={email} />
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionCls}>
              <div className={h2}>Таны статус</div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Role</div>
                  <div className="mt-2 text-lg font-extrabold text-black">{roleLabel}</div>
                </div>

                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Rank / Level</div>
                  <div className="mt-2 text-lg font-extrabold text-black">
                    {rank.name} <span className="text-black/50 text-sm font-bold">· L{rank.level}</span>
                  </div>
                </div>

                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Access</div>
                  <div className="mt-2 text-lg font-extrabold text-black">{accessStatus}</div>
                </div>
              </div>
            </section>

            <section className={sectionCls}>
              <div className={h2}>Account мэдээлэл</div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Status</div>
                  <div className="mt-2 text-lg font-extrabold text-black">{accountStatusLabel(userDoc?.accountStatus)}</div>
                </div>

                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Auth method</div>
                  <div className="mt-2 text-lg font-extrabold text-black">{authMethodLabel(userDoc?.authMethod)}</div>
                </div>

                <div className={cn("px-4 py-4", inner)}>
                  <div className="text-xs text-black/55 font-bold">Сүүлд нэвтэрсэн</div>
                  <div className="mt-2 text-base font-extrabold text-black">{lastLoginText}</div>
                </div>
              </div>
            </section>

            <div className="h-10" />
          </div>
        </div>
      </div>
    </>
  );
}