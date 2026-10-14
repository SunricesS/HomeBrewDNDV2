/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./public/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        dnd: {
          deepest: '#0d0907',
          primary: '#140f0c',
          secondary: '#1b140e',
          panel: '#221912',
          card: '#2a1f16',
          elevated: '#35271c',
          parchmentDark: '#2d2117',
          parchmentLight: '#f4ecd8',
          borderSubtle: 'rgba(197, 160, 89, 0.14)',
          borderDefault: 'rgba(197, 160, 89, 0.25)',
          borderAccent: 'rgba(197, 160, 89, 0.45)',
          borderGold: '#c5a059',
        },
        gold: {
          300: '#f5df88',
          400: '#e5c158',
          500: '#c5a059',
          600: '#8c6f34',
          700: '#644e23',
        },
        ruby: {
          400: '#aa2828',
          500: '#8b1e1e',
          600: '#5c1313',
        },
        emerald: {
          400: '#38a169',
          500: '#2e7d32',
          600: '#1b5e20',
        },
        amethyst: {
          400: '#9333ea',
          500: '#6b21a8',
          600: '#4c1d95',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        decorative: ['"Cinzel Decorative"', 'Cinzel', 'serif'],
        garamond: ['"EB Garamond"', 'serif'],
        alegreya: ['"Alegreya Sans"', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(197, 160, 89, 0.35)',
        'gold-glow-lg': '0 0 25px rgba(197, 160, 89, 0.50)',
        'ruby-glow': '0 0 15px rgba(139, 30, 30, 0.45)',
        'emerald-glow': '0 0 15px rgba(46, 125, 50, 0.40)',
        'inner-dark': 'inset 0 2px 6px rgba(0, 0, 0, 0.75)',
        'dnd-card': '0 8px 24px rgba(0, 0, 0, 0.75)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #e5c158, #8c6f34)',
        'ruby-gradient': 'linear-gradient(135deg, #aa2828, #5c1313)',
        'emerald-gradient': 'linear-gradient(135deg, #2e7d32, #1b5e20)',
        'panel-gradient': 'linear-gradient(180deg, rgba(34, 25, 18, 0.95), rgba(20, 15, 12, 0.98))',
        'modal-gradient': 'linear-gradient(180deg, #221912 0%, #17110c 100%)',
      },
    },
  },
  plugins: [],
};
