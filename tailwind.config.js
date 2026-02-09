/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pro Mode / Cyber-Forensic Palette
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d9ff',
          300: '#a3bfff',
          400: '#7a9cff',
          500: '#5271ff',
          600: '#3344ff', // Primary Brand
          700: '#262eff',
          800: '#1e24cc',
          900: '#1e24a3',
          950: '#121461',
        },
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          pink: '#ec4899',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b', // Card bg dark
          900: '#0f172a', // Main bg dark
          950: '#020617', // Deep bg
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}