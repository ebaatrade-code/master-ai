// lib/admin/requireAdmin.ts
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function requireAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const userRef = adminDb().collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return { ok: false as const, status: 403, error: "FORBIDDEN_NO_USER_DOC" };
    }

    const data = snap.data() as any;
    const role = String(data?.role || "").toLowerCase();

    if (role !== "admin") {
      return { ok: false as const, status: 403, error: "FORBIDDEN_NOT_ADMIN" };
    }

    return { ok: true as const, uid };
  } catch (e) {
    return { ok: false as const, status: 401, error: "INVALID_TOKEN" };
  }
}
