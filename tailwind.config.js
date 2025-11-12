// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // ESSENCIAL: Diz ao Tailwind onde procurar suas classes
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Cores personalizadas que você pode usar, como 'roxo-ressona'
      colors: {
        'roxo-ressona': '#A855F7',
        'ciano-ressona': '#06B6D4',
      }
    },
  },
  plugins: [],
}
