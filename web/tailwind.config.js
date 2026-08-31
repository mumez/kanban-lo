/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require("daisyui"),
    require("@tailwindcss/typography"),
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
    // Default theme is controlled by data-theme="light" on index.html
    darkTheme: "dark",
    logs: false,
  },
};
