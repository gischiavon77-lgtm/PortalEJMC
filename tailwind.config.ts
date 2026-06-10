import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'red-deep': '#150508',
        'red-dark': '#3d0a10',
        'red-mid': '#7a1220',
        'red-core': '#c0182e',
        'red-vivid': '#e8203a',
        'red-bright': '#ff3d54',
        cream: '#fff8f5',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      screens: {
        mobile: '320px',
        tablet: '768px',
        desktop: '1024px',
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, -8px)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.3s ease-out forwards',
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
