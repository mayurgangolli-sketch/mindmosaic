import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Luminous aqua & lagoon tones
        aqua: {
          50: "#F0FDFB",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
          950: "#042F2E",
        },
        // Fresh mint accents
        mint: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
        },
        // Deep oceanic teal night sanctuary
        night: {
          bg: "#071719",        // Deepest oceanic night background
          surface: "#0B2226",   // Primary card surface
          card: "#102C32",      // Layered elevated card
          cardHover: "#15363D", // Card hover state
          border: "#1C4750",    // Refined subtle teal border
          borderGlow: "#2DD4BF",// Highlight border
          muted: "#8FAFB5",     // Readable secondary text
          text: "#F0FDFB",      // Crisp readable heading text
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        'teal-glow': '0 0 25px -4px rgba(45, 212, 191, 0.22)',
        'teal-glow-lg': '0 0 35px -5px rgba(45, 212, 191, 0.35)',
        'soft-depth': '0 10px 30px -10px rgba(13, 148, 136, 0.12)',
        'soft-depth-dark': '0 12px 36px -12px rgba(0, 0, 0, 0.65)',
      },
    },
  },
  plugins: [],
};

export default config;
