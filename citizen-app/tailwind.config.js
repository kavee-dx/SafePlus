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

          background: "#F7FAF8",
          white: "#FFFFFF",

          text: "#17251C",
          muted: "#66736B",
          border: "#DDE7E0",
        },
      },
    },
  },

  plugins: [],
};