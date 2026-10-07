/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  presets: [require("nativewind/preset")],

  theme: {
    extend: {
      colors: {
        safeplus: {
          green: "#16A34A",
          darkGreen: "#14532D",
          deepGreen: "#064E3B",
          lightGreen: "#DCFCE7",
          paleGreen: "#F0FDF4",

          orange: "#F97316",
          lightOrange: "#FFEDD5",

          yellow: "#FACC15",
          lightYellow: "#FEF9C3",

          blue: "#1570EF",
          lightBlue: "#D1E9FF",

          red: "#D92D20",
          lightRed: "#FEE4E2",

          background: "#F7FAF8",
          white: "#FFFFFF",

          text: "#17251C",
          muted: "#66736B",
          border: "#DDE7E0",

          // Command-centre palette used by the registration flow
          navy: "#0F172A",
          navySoft: "#1E293B",
          navyLine: "#334155",
          navyText: "#CBD5E1",
          slate: "#64748B",
          canvas: "#F1F5F9",
          surface: "#FFFFFF",
          hairline: "#E2E8F0",
          fieldBg: "#F8FAFC",
          blueSoft: "#E8F1FE",
          amber: "#B54708",
          amberSoft: "#FEF0C7",
        },
      },
    },
  },

  plugins: [],
};