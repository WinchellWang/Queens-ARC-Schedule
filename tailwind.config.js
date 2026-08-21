/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './about.html'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        darkbg: '#121212',
        darkcard: '#1e1e1e',
        darktext: '#e5e5e5',
        queensred: '#b90e31',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
