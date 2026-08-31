/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media', // Hoặc 'class' nếu muốn manual toggle, 'media' tự theo Windows
  theme: {
    extend: {
      colors: {
        apple: {
          pink: '#FA243C',
          pinkHover: '#E01E35',
          darkBg: '#000000',
          darkSidebar: 'rgba(28, 28, 30, 0.75)',
          darkCard: 'rgba(44, 44, 46, 0.6)',
          lightBg: '#FFFFFF',
          lightSidebar: 'rgba(242, 242, 247, 0.75)',
          lightCard: 'rgba(255, 255, 255, 0.7)',
        }
      },
      backdropBlur: {
        apple: '30px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
