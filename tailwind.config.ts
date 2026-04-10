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
        display: ['"Rajdhani"', 'system-ui', 'sans-serif'],
        body: ['"Barlow"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(240, 185, 11, 0.7)' },
          '50%': { boxShadow: '0 0 0 6px rgba(240, 185, 11, 0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-gold': 'pulse-gold 1.8s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
