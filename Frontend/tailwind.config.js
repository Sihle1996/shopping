/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "#FF6F00",  // Orange (buttons & accents)
        secondary: "#FFB74D", // Light orange (background)
        background: "#ffff", 
        textDark: "#212121", // Dark text
        textLight: "#757575", // Light gray text
        borderColor: "#E0E0E0", // Border color
      },
      fontFamily: {
        primary: ["Poppins", "sans-serif"],
        heading: ["Montserrat", "sans-serif"],
        numbers: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Improves form styles (search, input fields, buttons)
    require('@tailwindcss/typography'), // Enhances text readability for descriptions
    require('@tailwindcss/aspect-ratio'), // Helps with image aspect ratios
  ],
};
