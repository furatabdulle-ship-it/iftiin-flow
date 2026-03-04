/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'iftiin-black': '#0D0D0D',
        'warm-white': '#F5F4F0',
        'iftiin-gold': '#C8A84B',
        'gold-light': '#E8D08A',
        'gold-dark': '#8C7030',
        'terrakotta': '#B85C38',
        'forest-green': '#2D4A3E',
        'warm-grey': '#9A9690',
        'tag-green-bg': '#E9F2ED',
        'tag-green-text': '#2D4A3E',
        'tag-yellow-bg': '#F9F1D8',
        'tag-yellow-text': '#C8A84B',
        'tag-red-bg': '#F9E9E9',
        'tag-red-text': '#B85C38',
        'tag-teal-bg': '#E9F2F2',
        'tag-teal-text': '#2D4A3E',
        'tag-pink-bg': '#F9E9F2',
        'tag-pink-text': '#B8388C',
        'tag-grey-bg': '#F0F0F0',
        'tag-grey-text': '#9A9690',
        'tag-purple-bg': '#E9E9F9',
        'tag-purple-text': '#5C38B8',
        gold: {
          100: '#F9F1D8',
          200: '#F0DEAA',
          400: '#E5C15D',
          500: '#C8A84B',
          600: '#8C7030',
          900: '#765d13',
        },
        black: '#0D0D0D',
        gray: {
          50: '#F5F4F0',
          100: '#F5F5F5',
          400: '#9A9690',
          900: '#0D0D0D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      animation: {
        'orbit': 'spin 60s linear infinite',
        'orbit-reverse': 'spin-reverse 45s linear infinite',
        'float': 'float 8s ease-in-out infinite',
        'pulse-slow': 'pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'drift': 'drift 20s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        drift: {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(40px, 20px)' },
        },
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
