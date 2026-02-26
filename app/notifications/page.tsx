"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type Noti = {
  id: string;
  title?: string;
  body?: string;

  // ✅ link
  href?: string;

  // ✅ NEW: бид notification дээр courseId хадгалдаг бол fallback линк үүсгэхэд хэрэгтэй
  courseId?: string;

  createdAt?: any;
  readAt?: any;
  read?: boolean;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function fmtTime(ts: any) {
  try {
    const d: Date | null =
      ts?.toDate?.()
        ? ts.toDate()
        : typeof ts === "string"
          ? new Date(ts)
          : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("mn-MN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** ✅ NEW: Notification-оос очих “зөв” линк
 * Танай screenshot дээр route: /course/<id>
 * Худалдан авах хэсэг рүү: #buy
 */
function resolveHref(n: Noti) {
  const raw = (n.href || "").trim();
  if (raw) return raw;

  const cid = String(n.courseId || "").trim();
  if (cid) return `/course/${cid}#buy`;

  return "";
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [items, setItems] = useState<Noti[]>([]);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Noti[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        setItems(out);
      },
      () => setItems([])
    );

    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((x: any) => !x?.readAt && x?.read !== true);
  }, [items, tab]);

  const unreadCount = useMemo(
    () => items.filter((x: any) => !x?.readAt && x?.read !== true).length,
    [items]
  );

  const markReadAndGo = async (n: Noti) => {
    if (!user) return;

    try {
      setBusyId(n.id);

      const isUnread = !(n as any)?.readAt && (n as any)?.read !== true;

      if (isUnread) {
        // ✅ Optimistic UI
        setItems((prev) =>
          prev.map((x: any) =>
            x.id === n.id ? { ...x, read: true, readAt: new Date() } : x
          )
        );

        await updateDoc(doc(db, "users", user.uid, "notifications", n.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      }

      const href = resolveHref(n);
      if (href) router.push(href);
    } catch (err) {
      console.error("markReadAndGo failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const tabBtn = (active: boolean) =>
    cn(
      "rounded-full px-4 py-2 text-sm font-extrabold ring-1 transition",
      active
        ? "bg-white text-black ring-black/25 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
        : "bg-white text-black ring-black/15 hover:bg-black/[0.04]"
    );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Top */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[22px] font-extrabold text-black">Мэдэгдэл</div>
          <div className="mt-1 text-sm text-black/60">
            Шинээсээ хуучин хүртэл бүгд энд байна.
          </div>
        </div>

        <Link
          href="/"
          className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-black ring-1 ring-black/15 hover:bg-black/[0.04]"
        >
          Нүүр
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={tabBtn(tab === "all")}
        >
          Бүгд
        </button>

        <button
          type="button"
          onClick={() => setTab("unread")}
          className={tabBtn(tab === "unread")}
        >
          Уншаагүй{" "}
          <span
            className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-extrabold ring-1",
              tab === "unread"
                ? "bg-white text-black ring-black/20"
                : "bg-black/[0.04] text-black ring-black/10"
            )}
          >
            {unreadCount}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
        {/* Not authed */}
        {!loading && !user && (
          <div className="p-6">
            <div className="text-[16px] font-extrabold text-black">
              Нэвтэрсний дараа мэдэгдлүүд харагдана.
            </div>
            <div className="mt-2 text-sm text-black/60">
              Мэдэгдэл нь хэрэглэгч бүр дээр тусдаа хадгалагдана.
            </div>
            <button
              onClick={() =>
                router.push(
                  `/login?callbackUrl=${encodeURIComponent("/notifications")}`
                )
              }
              className="mt-4 rounded-xl bg-black px-4 py-2.5 text-sm font-extrabold text-black hover:bg-black/90"
            >
              Нэвтрэх
            </button>
          </div>
        )}

        {/* List */}
        {!!user && (
          <>
            {filtered.length === 0 ? (
              <div className="p-6">
                <div className="text-[15px] font-extrabold text-black">
                  {tab === "unread"
                    ? "Уншаагүй мэдэгдэл алга."
                    : "Одоогоор мэдэгдэл алга."}
                </div>
                <div className="mt-1 text-sm text-black/60">
                  Шинэ зүйл гарвал энд хамгийн дээр нэмэгдэнэ.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-black/10">
                {filtered.map((n) => {
                  const isUnread =
                    !(n as any)?.readAt && (n as any)?.read !== true;
                  const time = fmtTime(n.createdAt);
                  const href = resolveHref(n);

                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markReadAndGo(n)}
                      className={cn(
                        "w-full text-left px-5 py-4 transition",
                        "hover:bg-black/[0.03]",
                        busyId === n.id && "opacity-70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* unread dot */}
                        <div
                          className={cn(
                            "mt-1.5 h-2.5 w-2.5 rounded-full",
                            isUnread ? "bg-blue-600" : "bg-black/20"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={cn(
                                "truncate text-[15px] font-extrabold",
                                isUnread ? "text-black" : "text-black/80"
                              )}
                            >
                              {n.title || "Мэдэгдэл"}
                            </div>
                            {time ? (
                              <div className="shrink-0 text-[12px] font-semibold text-black/45">
                                {time}
                              </div>
                            ) : null}
                          </div>

                          {n.body ? (
                            <div className="mt-1 line-clamp-2 text-[13px] text-black/60">
                              {n.body}
                            </div>
                          ) : null}

                          {href ? (
                            <div className="mt-2 text-[12px] font-extrabold text-black/55">
                              Дараад нээх ›
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}