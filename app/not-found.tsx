// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-white">404</h1>
      <p className="mt-2 text-white/70">Хуудас олдсонгүй</p>

      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/15"
        >
          Нүүр хуудас
        </Link>
        <Link
          href="/courses"
          className="rounded-xl bg-white/10 px-4 py-2 text-white hover:bg-white/15"
        >
          Сургалтууд
        </Link>
      </div>
    </div>
  );
}
