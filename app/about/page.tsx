// app/about/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Бидний тухай — Master AI",
  description: "Master AI онлайн сургалтын платформын тухай мэдээлэл.",
};

const FAQ = [
  {
    q: "Master AI гэж юу вэ?",
    a: "Master AI бол Монгол хэл дээр AI ур чадварын онлайн сургалтын платформ. Та өөрийн хурдаар суралцаж, бодитоор хэрэгжүүлэх чадвараа хөгжүүлнэ.",
  },
  {
    q: "Сургалтаа хаанаас үзэх вэ?",
    a: "Нэвтэрсний дараа “Миний сургалтууд” хэсэгт таны үзэх эрхтэй сургалтууд автоматаар гарч ирнэ.",
  },
  {
    q: "Төлбөр төлсний дараа шууд нээгдэх үү?",
    a: "Төлбөр баталгаажмагц таны эрх идэвхжиж, тухайн сургалт таны “Миний сургалтууд” хэсэгт нэмэгдэнэ.",
  },
  {
    q: "Асуудал гарвал яах вэ?",
    a: "Доорх “Асуудал шийдүүлэх” хэсгээр хүсэлт илгээвэл бид танд тусална.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-white text-black">
      {/* =========================
          TOP: About text + CTA
      ========================== */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-28 pb-10">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Бидний тухай
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-black/65 sm:text-lg sm:leading-8">
            Master AI бол Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн сургалтын
            платформ. Бидний зорилго бол AI-г “мэддэг” биш, бодитоор “хийдэг” болгож,
            ажлын бүтээмжийг нэмэх, контент үйлдвэрлэх, автоматжуулах ур чадварыг
            ойлгомжтой байдлаар хүргэх.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/contents"
              className="
                inline-flex items-center justify-center
                rounded-xl px-7 py-3
                text-sm font-extrabold uppercase tracking-wide
                text-black
                shadow-sm
                active:scale-[0.99]
                bg-sky-500 hover:bg-sky-600
                focus:outline-none focus:ring-2 focus:ring-sky-300
              "
            >
              СУРГАЛТ ҮЗЭХ
            </Link>
          </div>
        </div>
      </section>

      {/* Big white space like screenshot */}
      <div className="h-24 sm:h-28" />

      {/* =========================
          BOTTOM: Stat (center)
      ========================== */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-10">
        <div className="text-center">
          <div
            className="
              text-2xl font-extrabold uppercase tracking-wide
              sm:text-3xl
            "
            style={{ color: "#2B164A" }}
          >
            СҮҮЛИЙН НЭГ САРЫН ХУГАЦААНД
          </div>

          <div
            className="mt-10 font-extrabold tracking-tight text-center"
            style={{
              fontSize: "100px", // ✅ ЭНДЭЭС томруул/жижигрүүл
              lineHeight: "1",
            }}
          >
            <span style={{ color: "#9e1ab8" }}>1,432</span>
          </div>

          <div
            className="mt-4 text-sm font-extrabold uppercase tracking-wide sm:text-base"
            style={{ color: "#2B164A" }}
          >
            МАНАЙ ВЭБСАЙТЫГ ҮЗСЭН ХҮНИЙ ТОО
          </div>
        </div>
      </section>

      {/* =========================
          FAQ (under the stat label)
      ========================== */}
     <section className="mx-auto w-full max-w-6xl px-6 pb-32 pt-8">
        <div className="mx-auto max-w-3xl">
          <h2
            className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl"
            style={{ color: "#2B164A" }}
          >
            Түгээмэл асуулт
          </h2>

          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-black/10 bg-black/[0.02] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-extrabold text-black">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-black/60" />
                    {item.q}
                  </span>
                </summary>

                <p className="mt-2 text-sm leading-6 text-black/70">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 flex justify-center pb-10 sm:pb-14">
  <Link
    href="/request?source=about_faq"
    className="
      inline-flex items-center justify-center
      rounded-xl px-6 py-3
      text-sm font-extrabold uppercase tracking-wide
      text-white
      bg-black hover:bg-black/90
      active:scale-[0.99]
    "
  >
    Асуудал шийдүүлэх
  </Link>
</div>
        </div>
      </section>
    </main>
  );
}