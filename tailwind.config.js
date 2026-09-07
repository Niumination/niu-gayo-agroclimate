/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#fbf7f4',
          100: '#f5eee8',
          200: '#eddcd1',
          300: '#dfc2b1',
          400: '#cea28c',
          500: '#bc846a',
          600: '#a86c52',
          700: '#8c5541',
          800: '#734637',
          900: '#5e3a2f',
          950: '#341d17',
        },
      },
    },
  },
  plugins: [],
}
