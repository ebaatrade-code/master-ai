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
   Modern neon icons (inline SVG)
   (No extra library needed)
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
      <path
        d="M9 18.2h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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
      <path
        d="M5.2 8.2 12 13.2l6.8-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSpark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCamera({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 7h2l1-2h4l1 2h2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/* =========================
   Neon UI helpers
========================= */
function glowRing(level: number) {
  if (level >= 4) return "ring-2 ring-white/35";
  if (level >= 3) return "ring-2 ring-white/25";
  if (level >= 2) return "ring-2 ring-white/18";
  return "ring-1 ring-white/12";
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
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, { name: name.trim(), phone: phone.trim() }, { merge: true });
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
     UI classes (UPDATED: higher contrast + neon icons)
  ========================= */
  const sectionCls = "border-t border-white/10 pt-8 mt-8";
  const kvBox = "rounded-2xl border border-white/10 bg-black/60 px-4 py-4";

  const labelRow = "mb-2 flex items-center gap-2 text-sm font-extrabold text-white/90";
  const neonDot = "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15";
  const iconCls = "h-4 w-4 text-white/85";

  // ✅ more contrast inputs
  const inputWrap =
    "relative rounded-2xl border border-white/15 bg-black/50 ring-1 ring-white/5 focus-within:border-white/25 focus-within:ring-white/10";
  const inputBase =
    "w-full rounded-2xl bg-transparent pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/45 outline-none";
  const inputIcon =
    "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/75";
  const inputDisabled =
    "cursor-not-allowed opacity-95"; // ✅ no longer super-dim

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Ерөнхий мэдээлэл</h1>
            <p className="mt-2 text-sm text-white/60">
              Хэрэглэгчийн мэдээлэл • эрх/түвшин • account статус
            </p>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "mt-6 rounded-2xl border px-4 py-3 text-sm",
              toast.type === "ok" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-50",
              toast.type === "err" && "border-red-400/30 bg-red-400/10 text-red-50",
              toast.type === "info" && "border-white/15 bg-white/5 text-white/80"
            )}
          >
            <span className="font-semibold">{toast.text}</span>
          </div>
        )}

        {/* 1) Profile section */}
        <section className={sectionCls}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white/50"> ХЭРЭГЛЭГЧИЙН ҮНДСЭН МЭДЭЭЛЭЛ</div>
              <div className="mt-1 text-xl font-extrabold">Profile</div>
            </div>

            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-black hover:opacity-90"
              >
                Засах
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-bold hover:bg-white/10"
                >
                  Цуцлах
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-black hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            )}
          </div>

          {/* ✅ Modern Profile Card */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                {/* BIG AVATAR */}
                <div className="relative">
                  <div
                    className={cn(
                      "h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-3xl border border-white/15 bg-white/5",
                      glowRing(rank.level)
                    )}
                  >
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-3xl font-extrabold">
                        {((name || email || "U").trim()[0] || "U").toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* badge */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                    <div className="rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] font-extrabold text-white/90 backdrop-blur">
                      {levelBadgeText(rank.name, rank.level, roleLabel)}
                    </div>
                  </div>

                  {/* change avatar */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={!editing || avatarUploading}
                    className={cn(
                      "absolute -top-2 -right-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs font-bold backdrop-blur",
                      editing ? "hover:bg-white/10" : "opacity-50 cursor-not-allowed"
                    )}
                    title="Зураг солих"
                  >
                    <IconCamera className="h-4 w-4 text-white/90" />
                    {avatarUploading ? "..." : "Зураг"}
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

                {/* META */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-2xl font-extrabold">
                      {name?.trim() ? name : "PROFILE"}
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/75">
                      {roleLabel}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/75">
                      {accessStatus}
                    </span>
                  </div>

                  <div className="mt-1 truncate text-sm text-white/75">{email || "—"}</div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                    <div>
                      <span className="font-bold text-white/75">Бүртгүүлсэн:</span> {createdAtText}
                    </div>
                    <div>
                      <span className="font-bold text-white/75">Сүүлд нэвтэрсэн:</span> {lastLoginText}
                    </div>
                  </div>

                  {/* neon motivation pill */}
                  <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-black/40 px-3 py-2 text-xs text-white/80">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/15">
                      <IconSpark className="h-4 w-4 text-white/90" />
                    </span>
                    Өнөөдөр 10 минут үзвэл ахиц хамгийн хурдан нэмэгдэнэ.
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:items-end">
                <Link
                  href="/my-content"
                  className="rounded-full bg-white px-5 py-2 text-sm font-extrabold text-black hover:opacity-90 text-center"
                >
                  Үргэлжлүүлэх →
                </Link>

                <Link
                  href="/progress"
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-bold hover:bg-white/10 text-center"
                >
                  Ахиц харах
                </Link>
              </div>
            </div>

            {/* small stats row (kept, so we remove duplicated Preview section) */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-semibold text-white/60">Авсан курс</div>
                <div className="mt-1 text-2xl font-extrabold">{purchasedCount}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-semibold text-white/60">Нийт ахиц</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {fetchingStats ? "…" : `${progressPercent}%`}
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-white" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="mt-2 text-xs text-white/55">
                  Нийт курс: <span className="font-bold text-white/85">{totalCourses ?? "…"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-semibold text-white/60">Таны түвшин</div>
                <div className="mt-1 text-2xl font-extrabold">
                  L{rank.level} <span className="text-sm font-bold text-white/60">· {rank.name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Inputs: modern icon + neon */}
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {/* Name */}
            <div>
              <div className={labelRow}>
                <span className={neonDot}>
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

            {/* Phone */}
            <div>
              <div className={labelRow}>
                <span className={neonDot}>
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

            {/* Email read-only */}
            <div className="md:col-span-2">
              <div className={labelRow}>
                <span className={neonDot}>
                  <IconMail className={iconCls} />
                </span>
                Email (read-only)
              </div>
              <div className={cn(inputWrap, "cursor-not-allowed")}>
                <IconMail className={inputIcon} />
                <input className={cn(inputBase, "opacity-95")} readOnly value={email} />
              </div>
            </div>
          </div>
        </section>

        {/* 2) Rights / Level */}
        <section className={sectionCls}>
          <div className="text-xs font-bold text-white/50"> ЭРХ / ТҮВШИН (READ-ONLY)</div>
          <div className="mt-1 text-xl font-extrabold">Таны статус</div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Role</div>
              <div className="mt-2 text-lg font-extrabold">{roleLabel}</div>
            </div>

            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Rank / Level</div>
              <div className="mt-2 text-lg font-extrabold">
                {rank.name} <span className="text-white/50 text-sm font-bold">· L{rank.level}</span>
              </div>
            </div>

            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Access</div>
              <div className="mt-2 text-lg font-extrabold">{accessStatus}</div>
            </div>
          </div>
        </section>

        {/* 3) Account status */}
        <section className={sectionCls}>
          <div className="text-xs font-bold text-white/50"> ACCOUNT STATUS (READ-ONLY)</div>
          <div className="mt-1 text-xl font-extrabold">Account мэдээлэл</div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Status</div>
              <div className="mt-2 text-lg font-extrabold">
                {accountStatusLabel(userDoc?.accountStatus)}
              </div>
            </div>

            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Auth method</div>
              <div className="mt-2 text-lg font-extrabold">{authMethodLabel(userDoc?.authMethod)}</div>
            </div>

            <div className={kvBox}>
              <div className="text-xs text-white/60 font-semibold">Сүүлд нэвтэрсэн</div>
              <div className="mt-2 text-base font-extrabold">{lastLoginText}</div>
            </div>
          </div>
        </section>

        <div className="h-10" />
      </div>
    </div>
  );
}
