// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // ESSENCIAL: Diz ao Tailwind onde procurar suas classes
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Garante que ele procure em todos os seus arquivos de componente
    "./*.html",
  ],
  theme: {
    extend: {
      // Define a paleta de cores para as classes customizadas se houver
      colors: {
        'roxo-ressona': '#A855F7', // Exemplo: purple-500
        'ciano-ressona': '#06B6D4', // Exemplo: cyan-500
      }
    },
  },
  plugins: [],
}
