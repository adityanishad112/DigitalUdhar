import type { Config } from 'tailwindcss';

/**
 * Digital Udhar brand system.
 * Original palette (not a Khatabook clone): a trustworthy jade-teal primary,
 * a warm saffron accent, and calm ink neutrals. Green reads as "paid / cleared",
 * saffron as the warm Indian accent on key CTAs.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eafaf5',
          100: '#cbf3e6',
          200: '#98e6cf',
          300: '#5fd4b6',
          400: '#2fbb9a',
          500: '#12a082', // primary
          600: '#0a806b',
          700: '#0c6657',
          800: '#0e5147',
          900: '#0e433b',
          950: '#042722',
        },
        accent: {
          50: '#fff8eb',
          100: '#ffedc6',
          200: '#ffd888',
          300: '#ffbe4a',
          400: '#ffa41f',
          500: '#f98307',
          600: '#dd6002',
          700: '#b74106',
          800: '#94330c',
          900: '#7a2b0d',
          950: '#461402',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e2',
          300: '#aeb7c8',
          400: '#8290a8',
          500: '#61708c',
          600: '#4c5872',
          700: '#3f485d',
          800: '#373e4f',
          900: '#0f1729',
          950: '#080d18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,41,0.04), 0 8px 24px -12px rgba(15,23,41,0.12)',
        'card-lg': '0 2px 4px rgba(15,23,41,0.05), 0 18px 40px -16px rgba(15,23,41,0.18)',
        soft: '0 1px 3px rgba(15,23,41,0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'scale-in': 'scale-in 0.18s ease-out both',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
