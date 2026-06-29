/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: '#1e1e2e',
          surface: '#181825',
          border: '#313244',
        }
      }
    },
  },
  plugins: [],
}
