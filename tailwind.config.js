/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — teal/turquoise (Colina Tech atualizado)
        brand: {
          50:  '#f0fcfa',
          100: '#d0f7f2',
          200: '#a3f0e6',
          300: '#61EBDB', // hover/active dos botões primários
          400: '#33d6c2',
          500: '#23ccb7',
          600: '#1ACDB8', // primary
          700: '#168f7f',
          800: '#10665a',
          900: '#0b4940',
          950: '#062524',
        },
        accent: {
          DEFAULT: '#a3e635',
          soft: '#d9f99d',
        },
        surface: '#fafafa',     // page background
        panel: '#ffffff',       // cards / panels
        ink: '#0A0B0B',         // primary text
        muted: '#64748b',       // secondary text
        line: '#e5e7eb',        // borders / dividers
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        panel: '0 1px 0 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
