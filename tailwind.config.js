/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'game-bg': '#0f0f23',
        'game-card': '#1a1a3e',
        'game-accent': '#00ff87',
        'game-secondary': '#ff006e',
        'game-gold': '#ffd700',
      },
    },
  },
  plugins: [],
}