import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        horizon: {
          bg: '#101412',
          nav: '#090D0B',
          card: '#1B2420',
          'card-hover': '#222D28',
          accent: '#B8F36B',
          'accent-hover': '#CAFF85',
          emerald: '#287A59',
          text: '#F4F7F2',
          muted: '#9AA89D',
          border: '#303B34',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        horizon: '0 10px 30px -10px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config;
