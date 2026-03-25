// FILE: app/api/admin/courses/save/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin.server";
import { requireAdminFromRequest } from "@/lib/admin/requireAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseDurationToDays(input?: string): number | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;
  const num = raw.match(/(\d+)\s*/);
  const n = num ? Number(num[1]) : NaN;
  if (raw.includes("сар")) return Number.isFinite(n) && n > 0 ? n * 30 : 30;
  if (raw.includes("хоног") || raw.includes("өдөр") || raw.includes("day")) {
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

export async function POST(req: Request) {
  const gate = await requireAdminFromRequest(req);
  if (!gate.ok) {
    return noStore({ ok: false, error: gate.error }, gate.status);
  }

  const body = await req.json().catch(() => null);
  if (!body) return noStore({ ok: false, error: "Invalid JSON" }, 400);

  const courseId: string | null = body.courseId ? String(body.courseId).trim() : null;

  const title = String(body.title ?? "").trim();
  if (!title) return noStore({ ok: false, error: "title required" }, 400);

  const priceNum = Number(body.price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return noStore({ ok: false, error: "Invalid price" }, 400);
  }

  const oldPriceRaw =
    body.oldPrice === "" || body.oldPrice == null ? undefined : Number(body.oldPrice);
  if (oldPriceRaw !== undefined && !Number.isFinite(oldPriceRaw)) {
    return noStore({ ok: false, error: "Invalid oldPrice" }, 400);
  }
  const oldPriceNum =
    oldPriceRaw !== undefined && oldPriceRaw > 0 && oldPriceRaw > priceNum
      ? oldPriceRaw
      : undefined;

  const durationLabel = String(body.durationLabel ?? body.duration ?? "").trim() || null;
  const durationDays = durationLabel ? parseDurationToDays(durationLabel) : null;

  const shortDescription = String(body.shortDescription ?? "").trim() || null;
  const whoFor: string[] = Array.isArray(body.whoFor) ? body.whoFor.filter(Boolean) : [];
  const learn: string[] = Array.isArray(body.learn) ? body.learn.filter(Boolean) : [];
  const thumbnailUrl = String(body.thumbnailUrl ?? "").trim() || null;
  const isPublished = !!body.isPublished;

  const db = adminDb();

  try {
    if (!courseId) {
      // ── CREATE ───────────────────────────────────────────────────────────
      const newDoc: Record<string, any> = {
        title,
        price: priceNum,
        ...(durationLabel ? { duration: durationLabel, durationLabel } : {}),
        ...(durationDays && durationDays > 0 ? { durationDays } : {}),
        ...(shortDescription ? { shortDescription } : {}),
        ...(whoFor.length ? { whoFor } : {}),
        ...(learn.length ? { learn } : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        isPublished,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(isPublished ? { publishedAt: FieldValue.serverTimestamp() } : {}),
        ...(oldPriceNum !== undefined ? { oldPrice: oldPriceNum } : {}),
      };
      const ref = await db.collection("courses").add(newDoc);
      return noStore({ ok: true, courseId: ref.id, action: "created" });
    } else {
      // ── UPDATE ───────────────────────────────────────────────────────────
      const refDoc = db.collection("courses").doc(courseId);
      const prevSnap = await refDoc.get();
      const prev = prevSnap.exists ? (prevSnap.data() as any) : {};
      const prevIsPublished = prev?.isPublished === true;
      const prevNotifiedAt = !!prev?.notifiedPublishedAt;

      const updatePayload: Record<string, any> = {
        title,
        price: priceNum,
        durationLabel: durationLabel ?? FieldValue.delete(),
        duration: durationLabel ?? FieldValue.delete(),
        ...(durationDays && durationDays > 0
          ? { durationDays }
          : { durationDays: FieldValue.delete() }),
        shortDescription: shortDescription ?? FieldValue.delete(),
        whoFor: whoFor.length ? whoFor : FieldValue.delete(),
        learn: learn.length ? learn : FieldValue.delete(),
        thumbnailUrl: thumbnailUrl ?? FieldValue.delete(),
        isPublished,
        updatedAt: FieldValue.serverTimestamp(),
        oldPrice: oldPriceNum !== undefined ? oldPriceNum : FieldValue.delete(),
        ...(!prevIsPublished && isPublished ? { publishedAt: FieldValue.serverTimestamp() } : {}),
      };

      await refDoc.update(updatePayload);

      const justPublished = !prevIsPublished && isPublished && !prevNotifiedAt;
      return noStore({ ok: true, courseId, action: "updated", justPublished });
    }
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return noStore({ ok: false, error: msg }, 500);
  }
}
