import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#ececec] pt-16 pb-8 isolate relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">

          {/* ===== LEFT: BRAND ===== */}
          <div className="flex flex-col gap-6 md:col-span-2 lg:col-span-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg">
                <span className="text-xl font-bold tracking-tight text-white">M</span>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-black">
                MASTER AI
              </span>
            </div>

            <p className="max-w-xs text-sm leading-relaxed text-gray-400">
              Монголын хамгийн шилдэг хиймэл оюун ухааны онлайн сургалтын платформ. Ирээдүйн ур чадвараа өнөөдөр эзэмш.
            </p>

            {/* Social Icons */}
            <div className="flex gap-3 pt-1">
              <a href="https://www.facebook.com/Aistudiomongolia/" target="_blank" rel="noreferrer" aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white/5 text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-black">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white/5 text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-black">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="https://www.youtube.com/@ebacreator" target="_blank" rel="noreferrer" aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white/5 text-gray-400 transition-all duration-200 hover:bg-white/10 hover:text-black">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
              </a>
            </div>
          </div>

          {/* ===== MIDDLE-LEFT: QUICK LINKS ===== */}
          <div className="lg:col-span-2 lg:col-start-6">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span className="text-violet-400">•</span> Үндсэн цэс
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                { name: "Нүүр хуудас", href: "/" },
                { name: "Сургалтууд", href: "/contents" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-black"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ===== MIDDLE-RIGHT: HELP ===== */}
          <div className="lg:col-span-2">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span className="text-violet-400">•</span> Тусламж
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                { name: "Бидний тухай", href: "/about" },
                { name: "Асуудал шийдүүлэх", href: "/request?source=footer" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                   className="text-sm text-gray-400 transition-colors hover:text-black"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ===== RIGHT: CONTACT ===== */}
          <div className="lg:col-span-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span className="text-violet-400">•</span> Холбоо барих
            </h3>
            <ul className="mt-6 space-y-4">
              <li>
                <a
                  href="tel:+97672135031"
                  className="group flex items-center gap-3 text-sm text-gray-400 transition-colors hover:text-black"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-500 transition-colors group-hover:bg-white/10 group-hover:text-violet-400">
                    <Phone size={15} strokeWidth={2} />
                  </div>
                  <span>+976 7213 5031</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:ebaatrade@gmail.com"
                  className="group flex items-center gap-3 text-sm text-gray-400 transition-colors hover:text-black"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-500 transition-colors group-hover:bg-white/10 group-hover:text-violet-400">
                    <Mail size={15} strokeWidth={2} />
                  </div>
                  <span>ebaatrade@gmail.com</span>
                </a>
              </li>
              <li>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-500">
                    <MapPin size={15} strokeWidth={2} />
                  </div>
                  <span>Улаанбаатар, Монгол</span>
                </div>
              </li>
            </ul>
          </div>

        </div>

        {/* ===== BOTTOM COPYRIGHT ===== */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold text-violet-400">Ebacreator</span>.{" "}
            Бүх эрх хуулиар хамгаалагдсан.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Designed for : {" "}
            <span className="font-bold tracking-tight text-black">MASTER AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}