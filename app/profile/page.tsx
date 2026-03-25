"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, userDoc, loading } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);

  const email = useMemo(() => user?.email || userDoc?.email || "", [user?.email, userDoc?.email]);

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
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8 md:py-14">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-[30px] font-extrabold tracking-tight text-black md:text-[38px]">
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
            {/* Online dot */}
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
          <div className="flex flex-col gap-4 border-b border-black/8 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
            <div>
              <p className="text-[18px] font-bold tracking-tight text-black">Хувийн мэдээлэл</p>
              <p className="mt-0.5 text-[13px] text-black/40">Зөвхөн үндсэн мэдээллээ засах боломжтой.</p>
            </div>

            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={cn(goldBtn, "self-start md:self-auto")}
                style={{ background: "linear-gradient(135deg,#F4D27A,#F1C45B)" }}
              >
                <IconPencil className="h-4 w-4" />
                Засах
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 self-start md:self-auto">
                <button type="button" onClick={onCancel} className={ghostBtn}>
                  <IconX className="h-3.5 w-3.5" />
                  Цуцлах
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className={cn(goldBtn)}
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
          <div className="px-6 py-6 md:px-8 md:py-8">
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

              {/* Email — readonly, full width */}
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
  );
}
