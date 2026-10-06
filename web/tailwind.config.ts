import type { Config } from "tailwindcss";

/**
 * Единые настройки оформления (цвета, шрифты, отступы).
 * Единственный источник дизайн-токенов: новые цвета сначала появляются здесь,
 * а уже потом используются в компонентах (см. 04-klientskaya.md, раздел 3.1).
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Фирменный цвет (индиго).
        brand: {
          DEFAULT: "#4f46e5",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Поверхности.
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#fafafa",
          muted: "#f4f4f5",
        },
        // Текст.
        ink: {
          DEFAULT: "#18181b",
          muted: "#52525b",
          subtle: "#a1a1aa",
        },
        // Границы.
        edge: {
          DEFAULT: "#e4e4e7",
          strong: "#d4d4d8",
        },
        // Семантика.
        success: {
          DEFAULT: "#16a34a",
          subtle: "#f0fdf4",
          edge: "#bbf7d0",
        },
        warning: {
          DEFAULT: "#d97706",
          subtle: "#fffbeb",
          edge: "#fde68a",
        },
        danger: {
          DEFAULT: "#dc2626",
          subtle: "#fef2f2",
          edge: "#fecaca",
        },
        info: {
          DEFAULT: "#2563eb",
          subtle: "#eff6ff",
          edge: "#bfdbfe",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(24 24 27 / 0.05), 0 1px 3px 0 rgb(24 24 27 / 0.1)",
      },
      maxWidth: {
        // Ширина экрана компьютера по макету — 1280 пикселей.
        screen: "1280px",
      },
    },
  },
  plugins: [],
} satisfies Config;
