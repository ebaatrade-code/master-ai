import Link from "next/link";
import { Phone, Mail, Facebook, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="
        relative
        w-full
        border-t
        border-black
        bg-transparent
        isolate
      "
    >
      {/* ⛔ ULBAR SHAR TUIA-Г FORCE REMOVE */}
      <div className="absolute inset-0 -z-10 bg-transparent pointer-events-none" />

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* ===== LEFT: BRAND + CONTACT ===== */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="
                  grid h-12 w-12 place-items-center rounded-xl
                  bg-black/5 ring-1 ring-black/15
                  lg:bg-black/5 lg:ring-black/15
                "
              >
                <span className="text-base font-extrabold text-black lg:text-black">
                  M
                </span>
              </div>

              <div className="text-base font-extrabold text-black lg:text-black tracking-tight">
                Master AI
              </div>
            </div>

            <p className="max-w-sm text-sm text-black lg:text-black leading-relaxed">
              Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн сургалтын платформ.
            </p>

            {/* Contact */}
            <div className="space-y-2 text-sm text-black lg:text-black">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-black lg:text-black" />
                <span className="font-semibold text-black lg:text-black">
                  +976 7213 5031
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Mail size={16} className="text-black lg:text-black" />
                <span className="font-semibold text-black lg:text-black">
                  ebaatrade@gmail.com
                </span>
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-3 pt-2">
              {[
                {
                  href: "https://www.facebook.com/Aistudiomongolia/",
                  icon: <Facebook size={18} />,
                  label: "Facebook",
                },
                {
                  href: "https://instagram.com",
                  icon: <Instagram size={18} />,
                  label: "Instagram",
                },
                {
                  href: "https://www.youtube.com/@ebacreator",
                  icon: <Youtube size={18} />,
                  label: "YouTube",
                },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="
                    grid h-10 w-10 place-items-center rounded-full
                    bg-black/5 ring-1 ring-black/15
                    hover:bg-black/10 transition-all duration-200
                    lg:bg-black/5 lg:ring-black/15 lg:hover:bg-black/10
                  "
                >
                  <span className="text-black lg:text-black">{item.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* ===== MIDDLE: LINKS ===== */}
          <div>
            <h4 className="mb-4 text-sm font-extrabold text-black lg:text-black">
              Үндсэн цэс
            </h4>
            <ul className="space-y-2 text-sm text-black lg:text-black">
              <li>
                <Link
                  href="/"
                  className="font-semibold hover:text-black lg:hover:text-black transition-colors"
                >
                  Нүүр хуудас
                </Link>
              </li>
              <li>
                <Link
                  href="/contents"
                  className="font-semibold hover:text-black lg:hover:text-black transition-colors"
                >
                  Сургалтууд
                </Link>
              </li>
            </ul>
          </div>

          {/* ===== RIGHT: INFO ===== */}
          <div>
            <h4 className="mb-4 text-sm font-extrabold text-black lg:text-black">
              Тусламж
            </h4>
            <ul className="space-y-2 text-sm text-black lg:text-black">
              <li>
                <Link
                  href="/about"
                  className="font-semibold hover:text-black lg:hover:text-black transition-colors"
                >
                  Бидний тухай
                </Link>
              </li>

              {/* ✅ NEW: Request link (under "Бидний тухай") */}
              <li>
                <Link
                  href="/request?source=footer"
                  className="font-semibold hover:text-black lg:hover:text-black transition-colors"
                >
                  Асуудал шийдүүлэх
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ===== BOTTOM ===== */}
        <div className="mt-12 border-t border-black pt-6 text-center text-sm text-black lg:text-black">
          ©{" "}
          <span className="font-extrabold text-black lg:text-black">
            2026 Ebacreator
          </span>
          . Бүх эрх хуулиар хамгаалагдсан.
        </div>
      </div>
    </footer>
  );
}