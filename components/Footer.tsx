import Link from "next/link";
import { Phone, Mail, Facebook, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          
          {/* ===== LEFT: BRAND + CONTACT ===== */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
                <span className="text-sm font-bold">M</span>
              </div>
              <div className="text-sm font-semibold text-white/90">
                Master AI
              </div>
            </div>

            <p className="max-w-sm text-sm text-white/60">
              Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн сургалтын платформ.
            </p>

            {/* Contact */}
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Phone size={16} />
                <span>+976 9584 4981</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={16} />
                <span>ebaatrade@gmail.com</span>
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-3 pt-2">
              <a
                href="https://www.facebook.com/Aistudiomongolia/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/20 transition"
              >
                <Facebook size={18} />
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/20 transition"
              >
                <Instagram size={18} />
              </a>

              <a
                href="https://www.youtube.com/@ebacreator"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/20 transition"
              >
                <Youtube size={18} />
              </a>
            </div>
          </div>

          {/* ===== MIDDLE: LINKS ===== */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Үндсэн цэс
            </h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/" className="hover:text-white">Нүүр хуудас</Link></li>
              <li><Link href="/contents" className="hover:text-white">Сургалтууд</Link></li>

            </ul>
          </div>

          {/* ===== RIGHT: INFO ===== */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              Тусламж
            </h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/about" className="hover:text-white">Бидний тухай</Link></li>
              
            </ul>
          </div>
        </div>

        {/* ===== BOTTOM ===== */}
        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          © 2026 Master AI. Бүх эрх хуулиар хамгаалагдсан.
        </div>
      </div>
    </footer>
  );
}
