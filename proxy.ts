import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/admin/:path*",
    "/analist/:path*",
    "/api/:path*",
  ],
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // ── Security Headers ──────────────────────────────────────────────────
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // ── Admin / Analist: cache хориглоно ─────────────────────────────────
  if (pathname.startsWith("/admin") || pathname.startsWith("/analist")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
  }

  // ── /api/admin OPTIONS preflight ──────────────────────────────────────
  if (pathname.startsWith("/api/admin") && req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.SITE_URL || "",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // ── CORS: зөвхөн өөрийн домайн ────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin") || "";
    const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");

    if (origin && siteUrl && !origin.startsWith(siteUrl)) {
      // QPay callback нь external server-ээс ирдэг — origin шалгахгүй
      if (!pathname.startsWith("/api/qpay/callback")) {
        return new NextResponse(
          JSON.stringify({ ok: false, error: "CORS_REJECTED" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        );
      }
    }
  }

  return res;
}
