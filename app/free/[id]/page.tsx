"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { trackFreeLessonView } from "@/lib/trackFreeView";

type FreeLesson = {
  title: string;
  thumbnailUrl?: string;
  videoUrl: string;
};

export default function FreeLessonPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const { user, loading: loadingAuth } = useAuth();

  const [data, setData] = useState<FreeLesson | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Free контент: login хийсэн хүн л үзнэ
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      const cb = id ? `/free/${id}` : "/free";
      router.replace(`/login?callbackUrl=${encodeURIComponent(cb)}`);
    }
  }, [loadingAuth, user, router, id]);

  // ✅ Lesson fetch
  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, "freeLessons", id));
        if (!alive) return;

        if (snap.exists()) setData(snap.data() as FreeLesson);
        else setData(null);
      } catch (e) {
        console.error("free lesson read error:", e);
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    if (id) run();
    return () => {
      alive = false;
    };
  }, [id]);

  // ✅ View tracking (page open = 1 log)
  useEffect(() => {
    if (!id) return;
    if (loadingAuth) return;
    if (!user) return;

    trackFreeLessonView(id);
  }, [id, loadingAuth, user]);

  // auth redirect хийгдэх үед flash гаргахгүй
  if (loadingAuth) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10 text-white">
        <div className="h-10 w-40 rounded-full bg-white/10 animate-pulse" />
        <div className="mt-6 h-72 rounded-3xl bg-white/10 animate-pulse" />
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-white">
      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="
            group inline-flex items-center gap-2 rounded-full
            border border-white/10 bg-white/5 px-4 py-2 text-sm
            text-white/85 backdrop-blur
            hover:bg-white/10 hover:border-white/20
            transition
          "
        >
          <span className="transition group-hover:-translate-x-0.5">←</span>
          Буцах
        </button>

        <div className="text-xs text-white/45">
          Free lesson • {id ? `ID: ${id}` : ""}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          Ачаалж байна...
        </div>
      ) : !data ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          Контент олдсонгүй.
        </div>
      ) : (
        <>
          {/* TITLE CARD */}
          <div
            className="
              mt-6 rounded-3xl border border-cyan-400/25
              bg-black/30 backdrop-blur
              shadow-[0_0_40px_rgba(56,189,248,0.18)]
              p-6
            "
          >
            <div className="text-[11px] text-white/55">Үнэгүй хичээл</div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
              {data.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                ✅ Нэвтэрсэн хэрэглэгч
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                ▶️ Видео
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                🧊 Neon UI
              </span>
            </div>
          </div>

          {/* VIDEO FRAME (NEON) */}
          <div
            className="
              mt-6 group relative overflow-hidden rounded-3xl
              border-2 border-cyan-400/45
              bg-black/35 backdrop-blur
              shadow-[0_0_22px_rgba(56,189,248,0.35)]
              transition-all duration-300
              hover:border-cyan-300/70 hover:shadow-[0_0_48px_rgba(56,189,248,0.7)]
            "
          >
            {/* subtle glow overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <video
              controls
              className="relative z-10 h-auto w-full"
              src={data.videoUrl}
              poster={data.thumbnailUrl}
              playsInline
              preload="metadata"
            />
          </div>

          {/* FOOT NOTE */}
          <div className="mt-3 text-xs text-white/45">
            ✅ Free view log бичигдэж байна (freeLessonViews)
          </div>

          {/* CTA STRIP */}
          <div
            className="
              mt-8 rounded-3xl border border-white/10
              bg-white/5 p-5 text-sm text-white/70
              flex flex-col gap-3 md:flex-row md:items-center md:justify-between
            "
          >
            <div>
              <div className="font-semibold text-white/85">
                Дараагийн алхам?
              </div>
              <div className="mt-1 text-white/60">
                Илүү олон контент үзэх бол “Контентууд” хэсэг рүү ор.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/free")}
                className="
                  rounded-full border border-white/10 bg-white/5
                  px-5 py-3 text-sm font-semibold text-white/85
                  hover:bg-white/10 hover:border-white/20
                  transition
                "
              >
                Бүх үнэгүй →
              </button>

              <button
                onClick={() => router.push("/contents")}
                className="
                  rounded-full border-2 border-cyan-400/50
                  bg-gradient-to-r from-cyan-500 to-blue-600
                  px-5 py-3 text-sm font-extrabold text-white
                  shadow-[0_0_18px_rgba(56,189,248,0.55)]
                  hover:shadow-[0_0_34px_rgba(56,189,248,1)]
                  transition-all duration-300
                "
              >
                Контентууд →
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
