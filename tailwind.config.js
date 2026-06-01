/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/js/**/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        whatsapp: "#118C7E",
        whatsappLight: "#25D366",
        darkBlue: "#0F172A",
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
