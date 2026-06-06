import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'red-deep':   '#150508',
        'red-dark':   '#3d0a10',
        'red-mid':    '#7a1220',
        'red-core':   '#c0182e',
        'red-vivid':  '#e8203a',
        'red-bright': '#ff3d54',
        'cream':      '#fff8f5',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      screens: {
        mobile:  '320px',
        tablet:  '768px',
        desktop: '1024px',
      },
    },
  },
  plugins: [],
};

export default config;
