import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-inter)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1c1c1c',
          lighter: '#2a2a2a',
        },
        card: 'rgba(40, 40, 40, 0.4)',
        border: 'rgba(100, 116, 139, 0.3)',
        status: {
          pass: '#22c55e',
          fail: '#ef4444',
          unknown: '#64748b',
        },
      },
      backdropBlur: {
        glass: '10px',
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        elevated: '0 8px 25px -5px rgba(0, 0, 0, 0.25)',
        'glow-red-soft': '0 0 3px 1px rgba(239, 68, 68, 0.2)',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 6px 2px rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 2px 1px rgba(239, 68, 68, 0.15)' },
        },
        'glow-pulse-mid': {
          '0%, 100%': { boxShadow: '0 0 4px 1px rgba(239, 68, 68, 0.35)' },
          '50%': { boxShadow: '0 0 2px 1px rgba(239, 68, 68, 0.1)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-pulse-mid': 'glow-pulse-mid 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
