/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb5ff',
          400: '#598cff',
          500: '#3366ff',
          600: '#1f47f5',
          700: '#1936e1',
          800: '#1b2fb6',
          900: '#1c2f8f',
        },
      },
    },
  },
  plugins: [],
};
