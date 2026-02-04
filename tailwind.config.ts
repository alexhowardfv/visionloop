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
        display: ['var(--font-orbitron)', 'sans-serif'],
        body: ['var(--font-exo2)', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1e1e2e',
          lighter: '#2d3748',
        },
        card: 'rgba(30, 41, 59, 0.4)',
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
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.5)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.5)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'gradient-rotate': 'gradient-rotate 4s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
