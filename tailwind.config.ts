import type { Config } from 'tailwindcss';

/**
 * Design system do Portal Interno EJMC.
 *
 * Tokens espelham as variáveis CSS definidas em `src/app/globals.css`,
 * baseadas no design original do `login.html` (paleta vermelha, tipografia
 * Playfair Display + DM Sans, glassmorphism). A Task 1.6 refina detalhes
 * adicionais sobre este núcleo.
 *
 * Breakpoints (Requisitos 6 e 20):
 *   - Mobile  : viewport < 768px  (largura mínima suportada: 320px)
 *   - Tablet  : 768px ≤ viewport ≤ 1024px
 *   - Desktop : viewport > 1024px
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // Breakpoints do design system (Requisitos 6 e 20): mobile-first com
    // 320px de largura mínima suportada, transições em 768px (tablet) e
    // 1024px (desktop). Aliases semânticos `mobile`/`tablet`/`desktop`
    // mapeiam diretamente as faixas declaradas na especificação.
    screens: {
      // Faixas legadas (compatibilidade com utilidades padrão do Tailwind)
      xs: '320px',
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',

      // Aliases semânticos (Requisitos 20.1, 20.2, 20.3, 20.4)
      // Requisito 20.4: garantir layout sem rolagem horizontal a partir de 320px
      'min-mobile': '320px',
      // Requisito 20.3: mobile = viewport < 768px (apenas via prefixo `mobile:`)
      mobile: { max: '767px' },
      // Requisito 20.2: tablet = 768px ≤ viewport ≤ 1024px
      tablet: { min: '768px', max: '1024px' },
      // Requisito 20.1: desktop = viewport > 1024px
      desktop: { min: '1025px' },
    },
    extend: {
      colors: {
        // ─── Paleta vermelha EJMC ───
        red: {
          deep: 'var(--red-deep)',
          dark: 'var(--red-dark)',
          mid: 'var(--red-mid)',
          core: 'var(--red-core)',
          vivid: 'var(--red-vivid)',
          bright: 'var(--red-bright)',
        },
        cream: 'var(--cream)',

        // ─── Glassmorphism (camada escura / login) ───
        glass: {
          bg: 'var(--glass-bg)',
          border: 'var(--glass-border)',
        },
        input: {
          bg: 'var(--input-bg)',
          focus: 'var(--input-focus)',
        },

        // ─── Superfícies do portal interno (modo claro) ───
        surface: {
          bg: 'var(--surface-bg)',
          card: 'var(--surface-card)',
          sidebar: 'var(--surface-sidebar)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: {
          light: 'var(--border-light)',
        },

        // Aliases padrão usados pelo template inicial do Next
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },

      fontFamily: {
        heading: ['var(--font-heading)', 'Playfair Display', 'serif'],
        body: ['var(--font-body)', 'DM Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'DM Mono', 'monospace'],
        // sans default aponta para a fonte de corpo do design system
        sans: ['var(--font-body)', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },

      boxShadow: {
        deep: 'var(--shadow-deep)',
        card: 'var(--shadow-card)',
        sm: 'var(--shadow-sm)',
      },

      backdropBlur: {
        glass: '32px',
      },
      backdropSaturate: {
        glass: '1.4',
      },

      // Animações herdadas do login.html (blobs, partículas, reveal de cards)
      keyframes: {
        drift1: {
          from: { transform: 'translate(0,0) scale(1)' },
          to: { transform: 'translate(60px,40px) scale(1.1)' },
        },
        drift2: {
          from: { transform: 'translate(0,0) scale(1)' },
          to: { transform: 'translate(-50px,-30px) scale(1.08)' },
        },
        drift3: {
          from: { transform: 'translate(0,0) scale(1)' },
          to: { transform: 'translate(-40px,50px) scale(0.92)' },
        },
        drift4: {
          from: { transform: 'translate(0,0) scale(1)' },
          to: { transform: 'translate(30px,-40px) scale(1.15)' },
        },
        cardReveal: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '10%, 90%': { transform: 'translateX(-2px)' },
          '20%, 80%': { transform: 'translateX(4px)' },
          '30%, 50%, 70%': { transform: 'translateX(-4px)' },
          '40%, 60%': { transform: 'translateX(4px)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'drift-1': 'drift1 18s ease-in-out infinite alternate',
        'drift-2': 'drift2 22s ease-in-out infinite alternate',
        'drift-3': 'drift3 14s ease-in-out infinite alternate',
        'drift-4': 'drift4 20s ease-in-out infinite alternate',
        'card-reveal': 'cardReveal 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
        shake: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both',
        spin: 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
