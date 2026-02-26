"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function UnreadNotifBadge({ className }: { className?: string }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        let c = 0;
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data?.readAt) c += 1;
        });
        setUnread(c);
      },
      () => setUnread(0)
    );

    return () => unsub();
  }, [user?.uid]);

  const label = useMemo(() => {
    if (!unread) return "";
    return unread > 99 ? "99+" : String(unread);
  }, [unread]);

  if (!user?.uid || unread <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-extrabold",
        "bg-white text-black ring-1 ring-black/15 shadow-sm",
        className
      )}
    >
      {label}
    </span>
  );
}