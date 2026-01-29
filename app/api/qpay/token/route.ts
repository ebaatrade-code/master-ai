import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.QPAY_BASE || "https://merchant.qpay.mn";
const USERNAME = process.env.QPAY_USERNAME || "";
const PASSWORD = process.env.QPAY_PASSWORD || "";

export async function POST() {
  try {
    if (!USERNAME || !PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "NO_CREDENTIALS", message: "QPAY_USERNAME / QPAY_PASSWORD env тохируулаагүй байна." },
        { status: 500 }
      );
    }

    const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");

    const res = await fetch(`${BASE}/v2/auth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "auth/token",
          status: res.status,
          error: data?.error || "AUTH_FAILED",
          message: data?.message || "Нэвтрэх эрхгүй байна. Нэр/нууц үгээ шалга.",
          raw: data,
        },
        { status: res.status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        access_token: data?.access_token,
        expires_in: data?.expires_in,
        refresh_token: data?.refresh_token,
        token_type: data?.token_type,
        scope: data?.scope,
        raw: data,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "TOKEN_EXCEPTION", message: e?.message || "Token авахад алдаа гарлаа." },
      { status: 500 }
    );
  }
}
