/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#E76F51",
          50: "#FDF4F1",
          100: "#FAE3DA",
          200: "#F5C4B0",
          300: "#EF9F80",
          400: "#E98763",
          500: "#E76F51",
          600: "#C15A35",
          700: "#A04828",
        },
        brand: {
          dark:  "#264653",
          teal:  "#2A9D8F",
          gold:  "#E9C46A",
          warm:  "#F4A261",
        },
        surface: "#F9FAFB",
        background: "#ffffff",
        textDark: "#1F2937",
        textLight: "#6B7280",
        textMuted: "#9CA3AF",
        borderColor: "#E5E7EB",
        success: "#2A9D8F",
        danger: "#EF4444",
        warning: "#E9C46A",
      },
      fontFamily: {
        primary: ["Poppins", "sans-serif"],
        heading: ["Montserrat", "sans-serif"],
        numbers: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        float: "0 8px 24px -4px rgb(0 0 0 / 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        "bounce-in": "bounceIn 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
};
