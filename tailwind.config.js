/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./dashboard.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        attendly: {
          teal: {
            DEFAULT: "#173D37",
            50: "#F0F6F5",
            100: "#D9E9E6",
            200: "#B4D5D0",
            300: "#80B6AE",
            400: "#4D9387",
            500: "#2B7468",
            600: "#1E584F",
            700: "#173D37",
            800: "#122E2A",
            900: "#0D201D",
          },
          mint: {
            DEFAULT: "#A9F0C3",
            50: "#F2FDF7",
            100: "#E0FAEC",
            200: "#C4F5D8",
            300: "#A9F0C3",
            400: "#7CE7A5",
            500: "#4ADE80",
            600: "#22C55E",
            700: "#16A34A",
            800: "#15803D",
            900: "#14532D",
          },
          bg: {
            light: "#F8FAF9",
            dark: "#121A18",
          },
          card: {
            light: "#FFFFFF",
            dark: "#1A2523",
          },
          text: {
            primary: "#172B28",
            secondary: "#4A615D",
            muted: "#7A928E",
            darkPrimary: "#F1F5F4",
            darkSecondary: "#A7BCB8",
            darkMuted: "#6B817E",
          }
        }
      }
    },
  },
  plugins: [],
}
