import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
}
export default config
