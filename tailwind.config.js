/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'azure-blue':    '#0078d4',
        'azure-dark':    '#243A5E',
        'azure-neutral': '#faf9f8',
        'azure-border':  '#d2d0ce',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
