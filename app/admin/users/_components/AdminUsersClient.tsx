"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users, BadgeCheck, AlertTriangle, Activity, Gift, Bell, Eye, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Stats = {
  totalUsers: number;
  active7: number;
  paymentOpen: number;
  revenue30d: number | null;
};

type Row = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  avatarUrl?: string | null;
  purchasedCount: number;
  lastActiveAt?: string | null;
  hasPaymentIssueOpen: boolean;
};

type DetailRes = {
  ok: boolean;
  user: {
    uid: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatarUrl?: string | null;
    lastActiveAt?: string | null;
    purchasedCourseIds: string[];
  };
  purchases: Array<{
    id: string;
    courseId: string | null;
    status: string | null;
    provider: string | null;
    amount: number | null;
    reason: string | null;
    createdAt: string | null;
  }>;
  issues: Array<{
    id: string;
    status: "open" | "resolved" | string;
    reason: string;
    courseId: string | null;
    createdAt: string | null;
    resolvedAt: string | null;
  }>;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function avatarLetter(name: string) {
  const s = (name || "").trim();
  return s ? s[0]?.toUpperCase() : "U";
}

export default function AdminUsersClient() {
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "zero" | "payment" | "active7">("all");

  const [openUid, setOpenUid] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRes | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const chips = useMemo(
    () =>
      [
        { key: "all", label: "All" },
        { key: "vip", label: "VIP" },
        { key: "zero", label: "0 course" },
        { key: "payment", label: "Payment issue" },
        { key: "active7", label: "Active (7d)" },
      ] as const,
    []
  );

  async function getToken() {
    if (!user) throw new Error("Not signed in");
    return await user.getIdToken();
  }

  async function loadList() {
    setLoading(true);
    try {
      const token = await getToken();
      const url = `/api/admin/users/list?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}&limit=120`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "FAILED");
      setStats(data.stats);
      setRows(data.rows || []);
    } catch (e) {
      console.error(e);
      setStats(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function openUser(uid: string) {
    setOpenUid(uid);
    setDetail(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${uid}/detail`, { headers: { authorization: `Bearer ${token}` } });
      const data = (await res.json()) as DetailRes;
      if (!data?.ok) throw new Error("FAILED_DETAIL");
      setDetail(data);
    } catch (e) {
      console.error(e);
      setDetail(null);
    }
  }

  async function grantCourse(uid: string, courseId: string, reason: "promo" | "payment_fix" | "support") {
    setBusyAction("grant");
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${uid}/grant`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId, reason }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "GRANT_FAILED");
      await loadList();
      await openUser(uid);
    } finally {
      setBusyAction(null);
    }
  }

  async function sendNotif(uid: string, title: string, body: string, link: string, type: string) {
    setBusyAction("notify");
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${uid}/notify`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, body, link, type }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "NOTIFY_FAILED");
    } finally {
      setBusyAction(null);
    }
  }

  async function setPaymentIssue(uid: string, status: "open" | "resolved", reason: string, courseId?: string) {
    setBusyAction("issue");
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${uid}/payment-issue`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, reason, courseId: courseId || null }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "ISSUE_FAILED");
      await loadList();
      await openUser(uid);
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/60">Admin</div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <div className="mt-1 text-sm text-white/60">Сурагчдын удирдлага (grant / notify / payment issues)</div>
        </div>

        <button
          onClick={loadList}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total users" value={stats?.totalUsers ?? "—"} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Active (7d)" value={stats?.active7 ?? "—"} />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Payment issues"
          value={stats?.paymentOpen ?? "—"}
          accent="warn"
        />
        <StatCard
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Revenue (30d)"
          value={stats?.revenue30d == null ? "—" : `${stats.revenue30d.toLocaleString("mn-MN")}₮`}
        />
      </div>

      {/* Search + chips */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/40 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadList();
              }}
              placeholder="Search нэр / email / утас…"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  filter === c.key
                    ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-black/40 px-4 py-3 text-xs text-white/60">
          <div className="col-span-5">User</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Courses</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-white/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-white/60">No users.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={r.uid} className="grid grid-cols-12 gap-2 px-4 py-3">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        avatarLetter(r.name)
                      )}
                    </div>

                    {r.hasPaymentIssueOpen ? (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-black/60" />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {r.name}{" "}
                      {String(r.role || "").toLowerCase() === "vip" ? (
                        <span className="ml-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-200">
                          VIP
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      Last active: <span className="text-white/70">{fmtDate(r.lastActiveAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex items-center text-sm text-white/70">{r.email || "—"}</div>

                <div className="col-span-2 flex items-center">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white">
                    {r.purchasedCount}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openUser(r.uid)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {openUid ? (
        <Drawer onClose={() => setOpenUid(null)} title="User">
          {!detail ? (
            <div className="py-10 text-center text-sm text-white/60">Loading…</div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-base font-semibold text-white">
                  {detail.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarLetter(detail.user.name)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">
                    {detail.user.name || "Unnamed"}
                    {String(detail.user.role || "").toLowerCase() === "vip" ? (
                      <span className="ml-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-200">
                        VIP
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-white/70">{detail.user.email}</div>
                  <div className="mt-0.5 text-xs text-white/50">
                    Phone: <span className="text-white/70">{detail.user.phone || "—"}</span> · Last active:{" "}
                    <span className="text-white/70">{fmtDate(detail.user.lastActiveAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <ActionCard
                  icon={<Gift className="h-4 w-4" />}
                  title="Grant course"
                  desc="Promo / payment fix / support"
                >
                  <GrantForm
                    disabled={!!busyAction}
                    onGrant={(courseId, reason) => grantCourse(detail.user.uid, courseId, reason)}
                  />
                </ActionCard>

                <ActionCard icon={<Bell className="h-4 w-4" />} title="Send notification" desc="User inbox руу">
                  <NotifyForm
                    disabled={!!busyAction}
                    onSend={(t, b, link, type) => sendNotif(detail.user.uid, t, b, link, type)}
                  />
                </ActionCard>

                <ActionCard
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Payment issue"
                  desc="Open / Resolved"
                >
                  <IssueForm
                    disabled={!!busyAction}
                    hasOpen={detail.issues?.some((x) => x.status === "open")}
                    onSet={(status, reason, courseId) => setPaymentIssue(detail.user.uid, status, reason, courseId)}
                  />
                </ActionCard>
              </div>

              {/* Purchased courses */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 text-sm font-semibold text-white">Purchased courseIds</div>
                {detail.user.purchasedCourseIds.length === 0 ? (
                  <div className="text-sm text-white/60">None</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.user.purchasedCourseIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Purchases list */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 text-sm font-semibold text-white">Recent purchases</div>
                {detail.purchases.length === 0 ? (
                  <div className="text-sm text-white/60">No purchases found.</div>
                ) : (
                  <div className="space-y-2">
                    {detail.purchases.map((p) => (
                      <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-white">{p.courseId || "—"}</div>
                          <div className="text-xs text-white/60">{fmtDate(p.createdAt)}</div>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          status: <span className="text-white/80">{p.status || "—"}</span> · provider:{" "}
                          <span className="text-white/80">{p.provider || "—"}</span> · amount:{" "}
                          <span className="text-white/80">{p.amount ?? "—"}</span> · reason:{" "}
                          <span className="text-white/80">{p.reason || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Drawer>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
  accent?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-black/40 p-4",
        accent === "warn" ? "border-red-500/20" : "border-white/10"
      )}
    >
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <div className="text-xs">{label}</div>
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", accent === "warn" ? "text-red-200" : "text-white")}>
        {value}
      </div>
    </div>
  );
}

/**
 * ✅ FIX: Drawer-ийг дэлгэцэнд 100% багтаадаг болгосон.
 * - Safe area + 100dvh
 * - Drawer дотроо scroll (children хэсэг) зөв ажиллана
 * - Mobile дээр full screen, desktop дээр max-w-xl хэвээр
 */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        onClick={onClose}
        aria-label="Close backdrop"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />

      {/* ✅ Center Modal (desktop) / Fullscreen (mobile) */}
      <div className="absolute inset-0 flex items-start justify-center p-3 md:items-center md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "w-full overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl",
            // ✅ Mobile: fullscreen-like
            "h-[calc(100dvh-24px)]",
            // ✅ Desktop: big modal
            "md:h-[min(860px,calc(100dvh-48px))] md:max-w-5xl"
          )}
        >
          {/* Header (sticky) */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3">
            <div className="text-sm font-semibold text-white">{title}</div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body (scroll) */}
          <div className="h-[calc(100%-56px)] overflow-y-auto px-4 py-4">
            {children}
            <div className="h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-white/60">{desc}</div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function GrantForm({
  disabled,
  onGrant,
}: {
  disabled: boolean;
  onGrant: (courseId: string, reason: "promo" | "payment_fix" | "support") => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [reason, setReason] = useState<"promo" | "payment_fix" | "support">("promo");

  return (
    <div className="space-y-2">
      <input
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        placeholder="courseId (string)"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
      />
      <div className="flex gap-2">
        {(["promo", "payment_fix", "support"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              reason === r
                ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            )}
            type="button"
          >
            {r}
          </button>
        ))}
      </div>
      <button
        disabled={disabled || !courseId.trim()}
        onClick={() => onGrant(courseId.trim(), reason)}
        className={cn(
          "w-full rounded-xl px-3 py-2 text-sm font-semibold",
          disabled || !courseId.trim()
            ? "cursor-not-allowed bg-white/10 text-white/40"
            : "bg-orange-500 text-black hover:bg-orange-400"
        )}
      >
        Grant ✅
      </button>
    </div>
  );
}

function NotifyForm({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (title: string, body: string, link: string, type: string) => void;
}) {
  const [title, setTitle] = useState("Мэдэгдэл");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/my-content");
  const [type, setType] = useState("info");

  return (
    <div className="space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="title"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="body"
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/my-courses or /course/xxx"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="type (info/warn)"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />
      </div>
      <button
        disabled={disabled || !title.trim() || !body.trim()}
        onClick={() => onSend(title.trim(), body.trim(), link.trim() || "/my-content", type.trim() || "info")}
        className={cn(
          "w-full rounded-xl px-3 py-2 text-sm font-semibold",
          disabled || !title.trim() || !body.trim()
            ? "cursor-not-allowed bg-white/10 text-white/40"
            : "bg-white text-black hover:bg-white/90"
        )}
      >
        Send 🔔
      </button>
    </div>
  );
}

function IssueForm({
  disabled,
  hasOpen,
  onSet,
}: {
  disabled: boolean;
  hasOpen: boolean;
  onSet: (status: "open" | "resolved", reason: string, courseId?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [courseId, setCourseId] = useState("");

  return (
    <div className="space-y-2">
      <input
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        placeholder="courseId (optional)"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="reason (ж: qpay failed, bank error...)"
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={disabled}
          onClick={() => onSet("open", reason.trim(), courseId.trim() || undefined)}
          className={cn(
            "w-full rounded-xl px-3 py-2 text-sm font-semibold",
            disabled ? "cursor-not-allowed bg-white/10 text-white/40" : "bg-red-500/90 text-white hover:bg-red-500"
          )}
        >
          Mark OPEN 🚩
        </button>
        <button
          disabled={disabled || !hasOpen}
          onClick={() => onSet("resolved", reason.trim(), courseId.trim() || undefined)}
          className={cn(
            "w-full rounded-xl px-3 py-2 text-sm font-semibold",
            disabled || !hasOpen
              ? "cursor-not-allowed bg-white/10 text-white/40"
              : "bg-emerald-500/90 text-black hover:bg-emerald-500"
          )}
        >
          Resolve ✅
        </button>
      </div>
    </div>
  );
}