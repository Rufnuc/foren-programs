import type { Config } from "tailwindcss";

/**
 * Prutet design tokens.
 *
 * Colours are exposed as CSS custom properties (defined in globals.css) so
 * that the high-contrast theme can swap them by toggling
 * `data-contrast="high"` on <html>. Tailwind reads them via
 * `rgb(var(--token) / <alpha-value>)`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--prutet-bg) / <alpha-value>)",
        surface: "rgb(var(--prutet-surface) / <alpha-value>)",
        ink: "rgb(var(--prutet-ink) / <alpha-value>)",
        muted: "rgb(var(--prutet-muted) / <alpha-value>)",
        sage: "rgb(var(--prutet-sage) / <alpha-value>)",
        taupe: "rgb(var(--prutet-taupe) / <alpha-value>)",
        accent: "rgb(var(--prutet-accent) / <alpha-value>)",
        danger: "rgb(var(--prutet-danger) / <alpha-value>)",
        focus: "rgb(var(--prutet-focus) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
