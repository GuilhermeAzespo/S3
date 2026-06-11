/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eveo: {
          dark: '#1e1e24',
          darker: '#16161b',
          red: '#f90013',
          redHover: '#d00010',
          gray: '#2d2d35',
          text: '#f1f1f1'
        }
      }
    },
  },
  plugins: [],
}
