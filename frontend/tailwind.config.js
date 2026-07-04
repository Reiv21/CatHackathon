/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: "#0d0d1a",
          surface: "#1a1a2e",
          accent: "#0f3460",
          amber: "#e94560",
          "amber-light": "#f05a74",
          "accent-light": "#16213e",
        },
      },
      fontFamily: {
        mono: ['"Courier New"', "Courier", "monospace"],
      },
    },
  },
  plugins: [],
};
