import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1714",
        newsprint: "#f4f1ea",
        newsprintDark: "#e8e3d7",
        paperclipRed: "#c0392b",
        paperclipRedDark: "#8e2a20",
        wireGray: "#6b6258",
        rule: "#2b2620",
      },
      fontFamily: {
        masthead: ['"Playfair Display"', "Georgia", "serif"],
        serif: ['"Source Serif 4"', "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        clip: "0 1px 0 rgba(0,0,0,0.08), 0 8px 24px -12px rgba(0,0,0,0.35)",
      },
      keyframes: {
        livepulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.85)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeup: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        livepulse: "livepulse 1.4s ease-in-out infinite",
        ticker: "ticker 40s linear infinite",
        fadeup: "fadeup 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
