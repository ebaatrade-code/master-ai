// app/admin/requests/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

type ReqStatus = "OPEN" | "DONE";

type SupportRequest = {
  id: string;
  uid?: string | null;

  email?: string | null;
  phone?: string | null;
  message?: string | null;

  // ✅ optional: images
  imageUrls?: string[] | null;

  status?: ReqStatus;

  // ✅ we reuse existing field (no breaking schema)
  // UI дээр "Admin reply send" гэж харагдана
  adminNote?: string | null;

  createdAt?: any;
  handledAt?: any;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(ts: any) {
  try {
    const d =
      ts?.toDate?.() ??
      (ts?.seconds ? new Date(ts.seconds * 1000) : ts ? new Date(ts) : null);
    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function safeText(v: any) {
  if (v == null) return "—";
  const s = String(v);
  return s.trim() ? s : "—";
}

function tsToMs(ts: any) {
  try {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (ts?.toMillis) return ts.toMillis();
    if (ts?.seconds) return ts.seconds * 1000;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

export default function AdminRequestsPage() {
  const { user } = useAuth();

  const [roleLoading, setRoleLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SupportRequest[]>([]);

  // ✅ Tabs: "Нээлттэй" устгасан — зөвхөн DONE + ALL
  const [tab, setTab] = useState<"DONE" | "ALL">("ALL");
  const [qText, setQText] = useState("");

  const [active, setActive] = useState<SupportRequest | null>(null);

  // ✅ note state нь одоо "reply" болно (field нэрийг эвдэхгүй)
  const [note, setNote] = useState("");

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // ✅ Admin guard (users/{uid}.role == "admin")
  useEffect(() => {
    (async () => {
      try {
        if (!user?.uid) {
          setIsAdmin(false);
          return;
        }
        const uref = doc(db, "users", user.uid);
        const snap = await getDoc(uref);
        const data = snap.data() as any;
        const role = (data?.role || data?.userRole || "")
          .toString()
          .toLowerCase();
        setIsAdmin(role === "admin");
      } finally {
        setRoleLoading(false);
      }
    })();
  }, [user?.uid]);

  // ✅ Load requests
  useEffect(() => {
    setErrMsg(null);

    if (!user?.uid) {
      setLoading(false);
      setRows([]);
      return;
    }

    if (roleLoading) return;
    if (!isAdmin) {
      setLoading(false);
      setRows([]);
      return;
    }

    setLoading(true);

    const base = collection(db, "supportRequests");

    /**
     * ✅ IMPORTANT:
     * - ALL: orderBy(createdAt) OK (index шаарддаггүй)
     * - DONE: where(status=="DONE") + orderBy(createdAt) -> composite index шаардаж болно.
     *   Тиймээс DONE дээр orderBy авахгүй, client талдаа sort хийнэ.
     */
    const q =
      tab === "ALL"
        ? query(base, orderBy("createdAt", "desc"), limit(200))
        : query(base, where("status", "==", "DONE"), limit(200));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupportRequest[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: data.uid ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            message: data.message ?? null,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : null,
            status: (data.status as ReqStatus) ?? "OPEN",
            adminNote: data.adminNote ?? null,
            createdAt: data.createdAt ?? null,
            handledAt: data.handledAt ?? null,
          };
        });

        // ✅ DONE дээр client sort (шинэ нь дээр)
        if (tab === "DONE") {
          list.sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
        }

        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.error("supportRequests onSnapshot error:", err);
        setErrMsg(
          "Хүсэлтүүдийг ачааллаж чадсангүй. (Firestore query error) — Console дээр алдааг шалгаарай."
        );
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, roleLoading, isAdmin, tab]);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return rows;

    return rows.filter((r) => {
      const hay = [
        r.email,
        r.phone,
        r.message,
        r.uid,
        r.id,
        r.status,
        r.adminNote,
        (r.imageUrls || []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    });
  }, [rows, qText]);

  async function markDone(id: string) {
    const ref = doc(db, "supportRequests", id);
    await updateDoc(ref, {
      status: "DONE",
      handledAt: Timestamp.now(),
    });
  }

  async function markOpen(id: string) {
    const ref = doc(db, "supportRequests", id);
    await updateDoc(ref, {
      status: "OPEN",
      handledAt: null,
    });
  }

  // ✅ Reply Send action:
  // 1) supportRequests/{id}.adminNote update
  // 2) users/{uid}/notifications addDoc
  async function sendReplyFromModal() {
    if (!active) return;

    const uid = active.uid ?? null;
    if (!uid) {
      alert("Энэ хүсэлт uidгүй байна. Notification илгээж болохгүй.");
      return;
    }

    const reply = note.trim();
    if (!reply) {
      alert("Reply бичээд илгээнэ үү.");
      return;
    }

    setSending(true);
    try {
      // 1) Save to supportRequests (reuse adminNote field)
      await updateDoc(doc(db, "supportRequests", active.id), {
        adminNote: reply,
        updatedAt: Timestamp.now(),
      });

      // 2) Create notification for user
      await addDoc(collection(db, "users", uid, "notifications"), {
        title: "Админаас хариу ирлээ",
        body: reply,
        type: "ADMIN_REPLY", // ✅ MUST be a single string value
        read: false,
        requestId: active.id,
        fromAdminUid: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });

      // close modal
      setActive(null);
      setNote("");

      alert("Reply илгээгдлээ. Хэрэглэгчийн 'Шинэ мэдэгдэл' дээр очно.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Reply илгээхэд алдаа гарлаа.");
    } finally {
      setSending(false);
    }
  }

  const canView = !roleLoading && isAdmin;

  if (roleLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-black/60">Ачааллаж байна...</div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-black">Хүсэлтийн түүх</h1>
        <p className="mt-2 text-sm text-black/60">
          Энэ хэсгийг зөвхөн Admin үзнэ.
        </p>
      </div>
    );
  }

  const pill =
    "rounded-full px-3 py-1 text-xs font-extrabold border transition";
  const pillOn = "border-black/30 bg-black/[0.06] text-black";
  const pillOff = "border-black/15 bg-white text-black hover:bg-black/[0.04]";

  const btnStrokeRed =
    "inline-flex rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-extrabold text-black hover:bg-red-50 transition";
  const btnStrokeBlack =
    "rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-extrabold text-black hover:bg-black/[0.04] transition";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-black">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Хүсэлтийн түүх</h1>
          <p className="mt-1 text-sm text-black/60">
            Хэрэглэгчээс ирсэн асуудал/санал хүсэлтүүд.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex gap-2">
            {/* ✅ “Нээлттэй” устгасан */}
            <button
              onClick={() => setTab("DONE")}
              className={cn(pill, tab === "DONE" ? pillOn : pillOff)}
            >
              Шийдсэн
            </button>
            <button
              onClick={() => setTab("ALL")}
              className={cn(pill, tab === "ALL" ? pillOn : pillOff)}
            >
              Бүгд
            </button>
          </div>

          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Хайх: email / утас / текст..."
            className="w-full md:w-80 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-black/15 bg-white p-4">
        {errMsg ? (
          <div className="text-sm text-red-600 font-semibold">{errMsg}</div>
        ) : loading ? (
          <div className="text-sm text-black/60">Ачааллаж байна...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-black/60">Одоогоор хүсэлт алга.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs text-black/60">
                <tr className="border-b border-black/15">
                  <th className="py-3 pr-4">Огноо</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Утас</th>
                  <th className="py-3 pr-4">Хүсэлт</th>
                  <th className="py-3 pr-4">Төлөв</th>
                  <th className="py-3 pr-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    // ✅ хүсэлт бүрийн хооронд хар зураас (separator)
                    className="border-b border-black/20"
                  >
                    <td className="py-4 pr-4 align-top whitespace-nowrap">
                      <div className="font-semibold text-black">
                        {fmtDate(r.createdAt)}
                      </div>
                      {/* ✅ REMOVED: ID line */}
                    </td>

                    <td className="py-4 pr-4 align-top">
                      <div className="text-black">{safeText(r.email)}</div>
                      {/* ✅ REMOVED: uid line */}
                    </td>

                    <td className="py-4 pr-4 align-top">
                      <div className="text-black">{safeText(r.phone)}</div>
                    </td>

                    <td className="py-4 pr-4 align-top">
                      <div className="text-black line-clamp-2">
                        {safeText(r.message)}
                      </div>

                      {/* ✅ зураг хавсаргасан тоо */}
                      {r.imageUrls && r.imageUrls.length > 0 ? (
                        <div className="mt-1 text-xs text-black/60">
                          Зураг: {r.imageUrls.length}ш
                        </div>
                      ) : null}

                      {r.adminNote ? (
                        <div className="mt-1 text-xs text-black/60">
                          Admin reply: {r.adminNote}
                        </div>
                      ) : null}

                      {/* ✅ “Дэлгэрэнгүй” = бүдэг улаан stroke */}
                      <button
                        onClick={() => {
                          setActive(r);
                          setNote(r.adminNote || "");
                        }}
                        className={cn("mt-2", btnStrokeRed)}
                      >
                        Дэлгэрэнгүй
                      </button>
                    </td>

                    <td className="py-4 pr-4 align-top whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold border",
                          r.status === "DONE"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        )}
                      >
                        {r.status === "DONE" ? "Шийдсэн" : "Нээлттэй"}
                      </span>
                      {r.handledAt ? (
                        <div className="mt-1 text-xs text-black/50">
                          handled: {fmtDate(r.handledAt)}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-4 pr-2 align-top text-right whitespace-nowrap">
                      {/* ✅ “Шийдсэн болгох” = stroke */}
                      {r.status === "DONE" ? (
                        <button
                          onClick={() => markOpen(r.id)}
                          className={btnStrokeBlack}
                        >
                          Буцааж нээх
                        </button>
                      ) : (
                        <button
                          onClick={() => markDone(r.id)}
                          className={btnStrokeBlack}
                        >
                          Шийдсэн болгох
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 text-xs text-black/50">
              Сүүлд 200 бичлэгийг харуулж байна.
            </div>
          </div>
        )}
      </div>

      {/* ✅ Modal — цагаан болгов */}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-black/15 bg-white p-5 text-black shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">
                  Хүсэлтийн дэлгэрэнгүй
                </div>
                <div className="mt-1 text-xs text-black/60">
                  {fmtDate(active.createdAt)} • {active.id}
                </div>
              </div>
              <button
                onClick={() => setActive(null)}
                className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-extrabold hover:bg-black/[0.04]"
              >
                Хаах
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-black/15 bg-white p-3">
                  <div className="text-xs text-black/60">Email</div>
                  <div className="mt-1 text-sm font-bold text-black">
                    {safeText(active.email)}
                  </div>
                </div>
                <div className="rounded-xl border border-black/15 bg-white p-3">
                  <div className="text-xs text-black/60">Утас</div>
                  <div className="mt-1 text-sm font-bold text-black">
                    {safeText(active.phone)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-black/15 bg-white p-3">
                <div className="text-xs text-black/60">Хүсэлт</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-black">
                  {safeText(active.message)}
                </div>
              </div>

              {/* ✅ Images in modal */}
              {active.imageUrls && active.imageUrls.length > 0 ? (
                <div className="rounded-xl border border-black/15 bg-white p-3">
                  <div className="text-xs text-black/60">
                    Хавсаргасан зураг ({active.imageUrls.length})
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {active.imageUrls.map((u, i) => (
                      <a
                        key={u + i}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-black/10 bg-white hover:bg-black/[0.02]"
                        title="Open image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt={`attachment-${i + 1}`}
                          className="h-28 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-black/15 bg-white p-3">
                {/* ✅ label change */}
                <div className="text-xs text-black/60">Admin reply send</div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Admin reply..."
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* ✅ button change */}
                  <button
                    onClick={sendReplyFromModal}
                    disabled={sending}
                    className={cn(
                      "rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.04]",
                      sending && "opacity-60"
                    )}
                  >
                    {sending ? "Sending..." : "Reply Send"}
                  </button>

                  {active.status === "DONE" ? (
                    <button
                      onClick={async () => {
                        await markOpen(active.id);
                        setActive(null);
                      }}
                      className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.04]"
                    >
                      Буцааж нээх
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await markDone(active.id);
                        setActive(null);
                      }}
                      className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-extrabold hover:bg-black/[0.04]"
                    >
                      Шийдсэн болгох
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}