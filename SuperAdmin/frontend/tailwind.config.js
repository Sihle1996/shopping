/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 600: '#f97316', 700: '#ea580c' }
      }
    }
  },
  plugins: []
}
