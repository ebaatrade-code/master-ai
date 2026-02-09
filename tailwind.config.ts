// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* =========================
         FONT SYSTEM (Mulish)
      ========================= */
      fontFamily: {
        // 👉 className: font-main
        main: [
          "Mulish",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Arial",
          "sans-serif",
        ],
      },

      colors: {
        // 🖤 Core dark system
        surface: "#0b0b0f",
        card: "#0f1117",
        cardBorder: "rgba(255,255,255,0.08)",

        // ✨ Neon accents
        neonBlue: "#4fd1ff",
        neonPurple: "#a78bfa",
        neonPink: "#ff4fd8",

        // Text
        textPrimary: "#ffffff",
        textSecondary: "rgba(255,255,255,0.65)",
        textMuted: "rgba(255,255,255,0.45)",

        // ✨ Gold system (premium)
        gold: "#F4D27A",
        gold2: "#F1C45B",
        goldSoft: "rgba(244,210,122,0.20)",
        goldGlow: "rgba(244,210,122,0.28)",
      },

      boxShadow: {
        card: "0 20px 60px rgba(0,0,0,0.7)",
        neon: "0 0 0 1px rgba(255,255,255,0.08), 0 0 30px rgba(79,209,255,0.15)",

        glass: "0 18px 60px rgba(0,0,0,0.55)",
        goldGlow:
          "0 18px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), 0 0 46px rgba(244,210,122,0.12)",
      },

      backdropBlur: {
        glass: "18px",
      },

      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;