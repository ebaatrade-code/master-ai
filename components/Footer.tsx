import Link from "next/link";
import { Phone, Mail, Facebook, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="
        w-full border-t
        border-black/10 lg:border-white/10
        bg-white lg:bg-black/40
        lg:backdrop-blur
      "
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* ===== LEFT: BRAND + CONTACT ===== */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="
                  grid h-10 w-10 place-items-center rounded-xl
                  bg-black/5 ring-1 ring-black/10
                  lg:bg-white/10 lg:ring-white/10
                "
              >
                <span className="text-sm font-extrabold text-black lg:text-white/90">
                  M
                </span>
              </div>

              <div className="text-sm font-extrabold text-black lg:text-white/90">
                Master AI
              </div>
            </div>

            <p className="max-w-sm text-sm text-black/70 lg:text-white/60">
              Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн сургалтын платформ.
            </p>

            {/* Contact */}
            <div className="space-y-2 text-sm text-black/70 lg:text-white/70">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-black/60 lg:text-white/70" />
                <span className="font-semibold text-black lg:text-white/85">
                  +976 9584 4981
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Mail size={16} className="text-black/60 lg:text-white/70" />
                <span className="font-semibold text-black lg:text-white/85">
                  ebaatrade@gmail.com
                </span>
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-3 pt-2">
              <a
                href="https://www.facebook.com/Aistudiomongolia/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="
                  grid h-9 w-9 place-items-center rounded-full
                  bg-black/5 ring-1 ring-black/10 hover:bg-black/10 transition
                  lg:bg-white/10 lg:ring-white/10 lg:hover:bg-white/20
                "
              >
                <Facebook size={18} className="text-black/70 lg:text-white/80" />
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="
                  grid h-9 w-9 place-items-center rounded-full
                  bg-black/5 ring-1 ring-black/10 hover:bg-black/10 transition
                  lg:bg-white/10 lg:ring-white/10 lg:hover:bg-white/20
                "
              >
                <Instagram size={18} className="text-black/70 lg:text-white/80" />
              </a>

              <a
                href="https://www.youtube.com/@ebacreator"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="
                  grid h-9 w-9 place-items-center rounded-full
                  bg-black/5 ring-1 ring-black/10 hover:bg-black/10 transition
                  lg:bg-white/10 lg:ring-white/10 lg:hover:bg-white/20
                "
              >
                <Youtube size={18} className="text-black/70 lg:text-white/80" />
              </a>
            </div>
          </div>

          {/* ===== MIDDLE: LINKS ===== */}
          <div>
            <h4 className="mb-4 text-sm font-extrabold text-black lg:text-white">
              Үндсэн цэс
            </h4>
            <ul className="space-y-2 text-sm text-black/70 lg:text-white/70">
              <li>
                <Link href="/" className="font-medium hover:text-black lg:hover:text-white">
                  Нүүр хуудас
                </Link>
              </li>
              <li>
                <Link
                  href="/contents"
                  className="font-medium hover:text-black lg:hover:text-white"
                >
                  Сургалтууд
                </Link>
              </li>
            </ul>
          </div>

          {/* ===== RIGHT: INFO ===== */}
          <div>
            <h4 className="mb-4 text-sm font-extrabold text-black lg:text-white">
              Тусламж
            </h4>
            <ul className="space-y-2 text-sm text-black/70 lg:text-white/70">
              <li>
                <Link href="/about" className="font-medium hover:text-black lg:hover:text-white">
                  Бидний тухай
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ===== BOTTOM ===== */}
        <div className="mt-12 border-t border-black/10 lg:border-white/10 pt-6 text-center text-sm text-black/60 lg:text-white/50">
          © <span className="font-bold text-black lg:text-white/80">2026 Master AI</span>. Бүх эрх хуулиар хамгаалагдсан.
        </div>
      </div>
    </footer>
  );
}