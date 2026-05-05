/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/components/homepage/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#0694FB",
        "brand-dim": "rgba(6,148,251,0.17)",
        surface: "#0C0C0C",
        "surface-alt": "#0D0D0D",
        border: "#1E1E1E",
      },
      borderRadius: {
        card: "18px",
        pill: "11px",
      },
    },
  },
  plugins: [],
};
