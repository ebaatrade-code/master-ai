"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

function IconLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


function IconArrowLeft({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function IconUser({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.015-8 4.5V20h16v-1.5c0-2.485-3.582-4.5-8-4.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPhone({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M6.5 2.8h11c.94 0 1.7.76 1.7 1.7v15c0 .94-.76 1.7-1.7 1.7h-11c-.94 0-1.7-.76-1.7-1.7v-15c0-.94.76-1.7 1.7-1.7Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
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
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
      <path d="M5.2 8.2 12 13.2l6.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12.5 6.5 17.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4 20h4l11-11a2.1 2.1 0 0 0 0-3l-1-1a2.1 2.1 0 0 0-3 0L4 16v4Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
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

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function getInitial(name: string, email: string) {
  if (name?.trim()) return name.trim()[0].toUpperCase();
  if (email?.trim()) return email.trim()[0].toUpperCase();
  return "?";
}

function tsToMs(x: any): number | null {
  try {
    if (!x) return null;
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string") { const d = new Date(x); const ms = d.getTime(); return Number.isFinite(ms) ? ms : null; }
    if (typeof x?.toMillis === "function") { const ms = x.toMillis(); return Number.isFinite(ms) ? ms : null; }
    if (typeof x?.toDate === "function") { const d = x.toDate(); const ms = d?.getTime?.(); return Number.isFinite(ms) ? ms : null; }
    return null;
  } catch { return null; }
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, userDoc, loading, purchasedCourseIds } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);

  const email = useMemo(() => user?.email || userDoc?.email || "", [user?.email, userDoc?.email]);

  // Active course count — expired ones filtered out (same logic as my-content page)
  const activeCourseCount = useMemo(() => {
    const purchases = (userDoc as any)?.purchases ?? {};
    const now = Date.now();
    let count = 0;
    for (const courseId of purchasedCourseIds) {
      const p = purchases?.[courseId] ?? null;
      const expMs = tsToMs(p?.expiresAt);
      if (expMs && now > expMs) continue;
      count++;
    }
    return count;
  }, [purchasedCourseIds, userDoc]);

  const showToast = (type: "ok" | "err" | "info", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login?callbackUrl=%2Fprofile");
  }, [loading, user, router]);

  useEffect(() => {
    setName(userDoc?.name ?? "");
    setPhone(userDoc?.phone ?? "");
  }, [userDoc?.name, userDoc?.phone]);

  const onCancel = () => {
    setEditing(false);
    setName(userDoc?.name ?? "");
    setPhone(userDoc?.phone ?? "");
    showToast("info", "Өөрчлөлтийг цуцаллаа");
  };

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { name: name.trim(), phone: phone.trim() }, { merge: true });
      setEditing(false);
      showToast("ok", "Амжилттай хадгаллаа");
    } catch (e: any) {
      console.error(e);
      showToast("err", `Хадгалах алдаа: ${e?.message || "алдаа"}`);
    } finally {
      setSaving(false);
    }
  };

  // Shared style tokens
  const goldBtn =
    "inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_4px_16px_rgba(241,196,91,0.3)] transition hover:brightness-105 active:translate-y-px disabled:opacity-60";
  const ghostBtn =
    "inline-flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-white px-5 text-[13px] font-bold text-black transition hover:bg-black/[0.03] active:translate-y-px";
  const fieldBase =
    "group relative rounded-2xl border transition-all duration-200";
  const inputBase =
    "h-14 w-full rounded-2xl bg-transparent pl-12 pr-4 text-[15px] font-medium text-black placeholder:text-black/25 outline-none";
  const iconBase =
    "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200";
  const labelBase =
    "mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-black/40";


  return (
    <div className="min-h-screen bg-[#F2F1EE] md:bg-[#F7F6F3]">

      {/* ══════════════════════════════════════════════════════
          MOBILE LAYOUT  (md:hidden)
      ══════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col min-h-screen bg-[#ECECEC]">

        {/* Top nav bar */}
        <div className="flex items-center gap-2 bg-white border-b border-black/[0.08] px-3 h-14">
          <button
            onClick={() => router.back()}
            className="inline-flex h-9 w-9 items-center justify-center text-[#8B6914] active:opacity-60"
            aria-label="Буцах"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[17px] font-bold text-[#8B6914]">Profile</span>
        </div>

        {/* Toast — mobile */}
        {toast && (
          <div className={cn(
            "mx-4 mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13px] font-semibold",
            toast.type === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            toast.type === "err" && "border-red-200 bg-red-50 text-red-800",
            toast.type === "info" && "border-black/8 bg-white text-black/55"
          )}>
            {toast.type === "ok" && <IconCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
            {toast.type === "err" && <IconX className="h-4 w-4 shrink-0 text-red-500" />}
            {toast.text}
          </div>
        )}

        {/* Avatar section */}
        <div className="flex flex-col items-center pt-8 pb-7">
          <div className="relative">
            {/* outer white ring */}
            <div className="h-[92px] w-[92px] rounded-full bg-white flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.10)]">
              <div
                className="flex h-[82px] w-[82px] items-center justify-center rounded-full text-[34px] font-extrabold"
                style={{
                  background: "linear-gradient(145deg,#F4D27A,#D4900A)",
                  color: "#5C3D00",
                }}
              >
                {getInitial(name, email)}
              </div>
            </div>
            {/* Edit badge */}
            <button
              onClick={() => setEditing(true)}
              className="absolute bottom-0 right-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#3A2E0F] text-white shadow-lg active:scale-90 transition-transform"
              aria-label="Засах"
            >
              <IconPencil className="h-[14px] w-[14px]" />
            </button>
          </div>
          <p className="mt-4 text-[22px] font-extrabold text-black leading-snug tracking-tight">
            {name || "—"}
          </p>
          <p className="mt-0.5 text-[14px] text-black/45">{email || "—"}</p>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 space-y-3 pb-4">

          {/* Section header */}
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[16px] font-bold text-black">Хувийн мэдээлэл</p>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[15px] font-semibold text-[#8B6914] active:opacity-60"
              >
                Засах
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-[14px] font-semibold text-black/40 active:opacity-60"
                >
                  Цуцлах
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="text-[15px] font-semibold text-[#8B6914] disabled:opacity-40 active:opacity-60"
                >
                  {saving ? "Хадгалж..." : "Хадгалах"}
                </button>
              </div>
            )}
          </div>

          {/* Name card */}
          <div className="rounded-2xl bg-white px-4 pt-3 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-[10px] font-bold tracking-[0.16em] text-black/35 uppercase">
              НЭР / USERNAME
            </p>
            {editing ? (
              <input
                className="mt-1 w-full text-[16px] font-medium text-black bg-transparent outline-none placeholder:text-black/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Жишээ: Тулга"
                autoFocus
              />
            ) : (
              <p className="mt-1 text-[16px] font-medium text-black">{name || "—"}</p>
            )}
          </div>

          {/* Phone card */}
          <div className="rounded-2xl bg-white px-4 pt-3 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-[10px] font-bold tracking-[0.16em] text-black/35 uppercase">
              УТАС
            </p>
            {editing ? (
              <input
                className="mt-1 w-full text-[16px] font-medium text-black bg-transparent outline-none placeholder:text-black/20"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Жишээ: 99100000"
                inputMode="tel"
              />
            ) : (
              <p className="mt-1 text-[16px] font-medium text-black">{phone || "—"}</p>
            )}
          </div>

          {/* Email card */}
          <div className="rounded-2xl bg-white px-4 pt-3 pb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.16em] text-black/35 uppercase">
                МАЙЛ ХАЯГ
              </p>
              <p className="mt-1 text-[16px] font-medium text-black/45 truncate">{email || "—"}</p>
            </div>
            <IconLock className="h-5 w-5 text-black/20 flex-shrink-0 mb-0.5" />
          </div>

          {/* My courses card */}
          <div
            className="rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg,#DDEEFF,#C8E4FF)" }}
          >
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#2563EB] uppercase">
                МИНИЙ СУРГАЛТУУД
              </p>
              <p className="mt-1 text-[28px] font-extrabold text-[#1E3A5F] leading-none">
                {activeCourseCount}
              </p>
            </div>
            <a
              href="/my-content"
              className="inline-flex items-center justify-center rounded-full bg-[#1A2332] text-white text-[12px] font-bold px-5 h-10 tracking-wide active:scale-95 transition-transform"
            >
              ХАРАХ
            </a>
          </div>

        </div>

      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP LAYOUT  (hidden on mobile)
      ══════════════════════════════════════════════════════ */}
      <div className="hidden md:block">
        <div className="mx-auto w-full max-w-4xl px-8 py-14">

          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-[38px] font-extrabold tracking-tight text-black">
              Профайл
            </h1>
            <p className="mt-2 text-[14px] text-black/50">
              Өөрийн нэр, утас, майл хаягийн мэдээллээ эндээс удирдана.
            </p>
          </div>

          {/* Toast */}
          {toast && (
            <div className={cn(
              "mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13px] font-semibold",
              toast.type === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
              toast.type === "err" && "border-red-200 bg-red-50 text-red-800",
              toast.type === "info" && "border-black/8 bg-white text-black/55"
            )}>
              {toast.type === "ok" && <IconCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
              {toast.type === "err" && <IconX className="h-4 w-4 shrink-0 text-red-500" />}
              {toast.text}
            </div>
          )}

          {/* Avatar banner */}
          <div className="mb-4 flex items-center gap-5 rounded-3xl border border-black/8 bg-white px-6 py-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            <div className="relative shrink-0">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-extrabold text-black"
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)", boxShadow: "0 4px 16px rgba(241,196,91,0.4)" }}
              >
                {getInitial(name, email)}
              </div>
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold text-black">{name || "—"}</p>
              <p className="truncate text-[13px] text-black/40">{email || "—"}</p>
            </div>
          </div>

          {/* Main card */}
          <section className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.07)]">

            {/* Card header */}
            <div className="flex flex-row items-center justify-between border-b border-black/8 px-8 py-6">
              <div>
                <p className="text-[18px] font-bold tracking-tight text-black">Хувийн мэдээлэл</p>
                <p className="mt-0.5 text-[13px] text-black/40">Зөвхөн үндсэн мэдээллээ засах боломжтой.</p>
              </div>

              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={goldBtn}
                  style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
                >
                  <IconPencil className="h-4 w-4" />
                  Засах
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={onCancel} className={ghostBtn}>
                    <IconX className="h-3.5 w-3.5" />
                    Цуцлах
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className={goldBtn}
                    style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
                  >
                    {saving ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                        Хадгалж байна...
                      </>
                    ) : (
                      <>
                        <IconCheck className="h-3.5 w-3.5" />
                        Хадгалах
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Fields */}
            <div className="px-8 py-8">
              <div className="grid gap-5 md:grid-cols-2">

                {/* Name */}
                <div>
                  <label className={labelBase}>Нэр / Username</label>
                  <div className={cn(
                    fieldBase,
                    editing
                      ? "border-black/12 bg-white focus-within:border-[#F1C45B] focus-within:shadow-[0_0_0_3px_rgba(241,196,91,0.14)]"
                      : "border-black/8 bg-black/[0.02]"
                  )}>
                    <IconUser className={cn(iconBase, editing ? "text-black/35 group-focus-within:text-black/65" : "text-black/25")} />
                    <input
                      className={cn(inputBase, "disabled:cursor-default")}
                      disabled={!editing}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Жишээ: Tylraaa"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className={labelBase}>Утас</label>
                  <div className={cn(
                    fieldBase,
                    editing
                      ? "border-black/12 bg-white focus-within:border-[#F1C45B] focus-within:shadow-[0_0_0_3px_rgba(241,196,91,0.14)]"
                      : "border-black/8 bg-black/[0.02]"
                  )}>
                    <IconPhone className={cn(iconBase, editing ? "text-black/35 group-focus-within:text-black/65" : "text-black/25")} />
                    <input
                      className={cn(inputBase, "disabled:cursor-default")}
                      disabled={!editing}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Жишээ: 99100000"
                      inputMode="tel"
                    />
                  </div>
                </div>

                {/* Email — readonly */}
                <div className="md:col-span-2">
                  <label className={labelBase}>Майл хаяг</label>
                  <div className="relative rounded-2xl border border-black/8 bg-black/[0.02]">
                    <IconMail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/25" />
                    <input
                      className="h-14 w-full cursor-not-allowed rounded-2xl bg-transparent pl-12 pr-36 text-[15px] font-medium text-black/55 outline-none"
                      readOnly
                      value={email}
                      placeholder="—"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/35">
                      🔒 Өөрчлөх боломжгүй
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-black/35">
                    Майл хаяг нь одоогоор зөвхөн харагдана.
                  </p>
                </div>

              </div>
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}
