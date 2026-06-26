import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#efe7d3",
          warm: "#f3ecdb",
          deep: "#e6dcc1",
          edge: "#ddd2b3",
        },
        ink: {
          DEFAULT: "#171411",
          soft: "#2a2520",
        },
        graphite: {
          DEFAULT: "#6a635a",
          light: "#8d867b",
        },
        tape: {
          DEFAULT: "#d6c79a",
          dark: "#b9a978",
          shadow: "#9a8a5b",
        },
        vermilion: {
          DEFAULT: "#c8331e",
          deep: "#a52414",
          ink: "#7a1a0e",
        },
        reel: {
          DEFAULT: "#1c1814",
          rim: "#2e2620",
        },
      },
      fontFamily: {
        grotesk: ["var(--font-grotesk)", "Barlow Condensed", "Helvetica Neue Condensed", "sans-serif"],
        serif: ["var(--font-serif)", "EB Garamond", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
        DEFAULT: "1px",
        sm: "1px",
        md: "2px",
        lg: "2px",
      },
      letterSpacing: {
        tcode: "0.08em",
        wide: "0.16em",
        wider: "0.24em",
      },
      animation: {
        flicker: "flicker 4s linear infinite",
        sprocket: "sprocket 1.6s linear infinite",
      },
      keyframes: {
        flicker: {
          "0%, 96%, 100%": { opacity: "1" },
          "97%": { opacity: "0.92" },
          "98%": { opacity: "1" },
          "99%": { opacity: "0.88" },
        },
        sprocket: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-24px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
