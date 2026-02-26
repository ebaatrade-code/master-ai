// lib/notifications.ts
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * 🔧 CHANGE THIS IF your schema is different:
 * - Option 1 (global): notifications/{id} with fields { uid, isRead, createdAt }
 * - Option 2 (subcollection): users/{uid}/notifications/{id}
 */
export const NOTIF_SCHEMA = {
  mode: "global" as "global" | "subcollection",
  globalCollection: "notifications",
  subcollection: "notifications", // users/{uid}/notifications
  fieldUid: "uid",
  fieldIsRead: "isRead",
  fieldCreatedAt: "createdAt",
  fieldReadAt: "readAt",
};

export type AppNotification = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: any;
  isRead?: boolean;
  readAt?: any;
  // add anything else you store
};

function notifColRef(uid: string) {
  if (NOTIF_SCHEMA.mode === "subcollection") {
    return collection(db, "users", uid, NOTIF_SCHEMA.subcollection);
  }
  return collection(db, NOTIF_SCHEMA.globalCollection);
}

export function listenUnreadCount(uid: string, cb: (count: number) => void) {
  const col = notifColRef(uid);

  const q =
    NOTIF_SCHEMA.mode === "subcollection"
      ? query(
          col,
          where(NOTIF_SCHEMA.fieldIsRead, "==", false),
          limit(200)
        )
      : query(
          col,
          where(NOTIF_SCHEMA.fieldUid, "==", uid),
          where(NOTIF_SCHEMA.fieldIsRead, "==", false),
          limit(200)
        );

  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => cb(snap.size),
    () => cb(0)
  );
}

export async function markNotificationRead(uid: string, notifId: string) {
  // doc path depends on schema mode
  const ref =
    NOTIF_SCHEMA.mode === "subcollection"
      ? doc(db, "users", uid, NOTIF_SCHEMA.subcollection, notifId)
      : doc(db, NOTIF_SCHEMA.globalCollection, notifId);

  await updateDoc(ref, {
    [NOTIF_SCHEMA.fieldIsRead]: true,
    [NOTIF_SCHEMA.fieldReadAt]: serverTimestamp(),
  });
}

export async function fetchNotifications(uid: string) {
  const col = notifColRef(uid);

  const q =
    NOTIF_SCHEMA.mode === "subcollection"
      ? query(col, orderBy(NOTIF_SCHEMA.fieldCreatedAt, "desc"), limit(200))
      : query(
          col,
          where(NOTIF_SCHEMA.fieldUid, "==", uid),
          orderBy(NOTIF_SCHEMA.fieldCreatedAt, "desc"),
          limit(200)
        );

  const snap = await getDocs(q);
  const rows: AppNotification[] = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      title: data.title,
      body: data.body,
      createdAt: data[NOTIF_SCHEMA.fieldCreatedAt],
      isRead: Boolean(data[NOTIF_SCHEMA.fieldIsRead]),
      readAt: data[NOTIF_SCHEMA.fieldReadAt],
    };
  });

  return rows;
}