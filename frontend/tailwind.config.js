/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fdf4f3",
          100: "#fce8e6",
          200: "#f9d4d1",
          300: "#f4b3ad",
          400: "#ec8a80",
          500: "#e06050",
          600: "#cc4436",
          700: "#ab362a",
          800: "#8d3027",
          900: "#762d26",
        },
        warm: {
          50: "#fefaf6",
          100: "#fdf3ea",
          200: "#fae5d1",
          300: "#f5cfae",
          400: "#efb080",
          500: "#e89255",
          600: "#da7535",
          700: "#b55d2a",
          800: "#914b28",
          900: "#754023",
        },
        cat: {
          cream: "#fef9f4",
          sand: "#f5e6d3",
          orange: "#e8824a",
          brown: "#6b4423",
          dark: "#2d1f14",
          charcoal: "#1a1512",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
