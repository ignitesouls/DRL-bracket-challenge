import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Twitch-inspired palette
        twitch: {
          purple: '#9146FF',
          'purple-dark': '#6441A5',
          'purple-light': '#B994FF',
        },
        bracket: {
          bg: '#0E0E1A',
          surface: '#1A1A2E',
          'surface-2': '#252540',
          border: '#3A3A5C',
          gold: '#F0B90B',
          'gold-light': '#FFD55A',
        },
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
