import type { Config } from 'tailwindcss';

/**
 * Tokens do design system do Portal EJMC (tema escuro único).
 *
 * Fonte única de cores, fontes, cantos e medidas de layout. Os mesmos
 * valores existem como CSS variables em `src/app/globals.css` (para CSS
 * escrito à mão). Ao mudar um valor, mude nos dois lugares.
 *
 * Identidade:
 *   - `brand` (#87000a) é a ÚNICA cor de destaque: botão principal, item
 *     ativo do menu, "hoje" no calendário e subtítulos de página.
 *   - Sobre fundo escuro o `brand` tem contraste baixo (~1,9:1). Texto
 *     corrido, de tabela, rótulos e textos pequenos usam `text`/`text-soft`.
 *   - `danger`, `ok`, `warn` e `info` são cores auxiliares discretas, só
 *     para mensagens de erro e etiquetas de status/categoria.
 *   - Títulos: League Spartan (`font-heading`), brancos e em negrito.
 *     Restante: Montserrat (`font-body`), nunca em maiúsculas.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Superfícies ───
        bg: '#0a0a0b', // fundo da página
        surface: '#141416', // cards, sidebar, modais
        'surface-raised': '#1c1c1f', // campos de formulário, itens de menu em hover
        'surface-hover': '#0c0c0e', // card ou linha sob o mouse: mais escuro que o card
        border: '#26262a', // borda de 1px de cards, campos e divisórias

        // ─── Texto ───
        text: '#ffffff', // títulos e texto principal
        'text-soft': '#a1a1aa', // texto de apoio, rótulos
        'text-faint': '#71717a', // texto discreto, placeholders, estados vazios

        // ─── Marca ───
        brand: '#87000a', // vermelho EJMC — única cor de destaque
        'brand-hover': '#a1000c', // derivado do brand, para hover de botões

        // ─── Auxiliares discretas (erro e etiquetas de status) ───
        danger: '#e0545c', // texto de erro (derivado claro do brand)
        ok: '#5fb38a',
        warn: '#c9a24a',
        info: '#6f9bd1',

        // ─── Cor de cada área (fio discreto no álbum e no perfil) ───
        'area-vendas': '#4fa39a',
        'area-presidencia': '#87000a',
        'area-projetos': '#c98a4a',
        'area-marketing': '#9a7bc4',
        'area-gp': '#6f9bd1',
        'area-admfin': '#c9a24a',

        // ─── Categorias de evento do calendário (Fase 4) ───
        // Tons apagados; ver src/lib/event-categories.ts.
        'cat-institucional': '#6f9bd1',
        'cat-area': '#4fa39a',
        'cat-projetos': '#c98a4a',
        'cat-comercial': '#c9a24a',
        'cat-capacitacao': '#9a7bc4',
        'cat-ps': '#c47a96',
        'cat-eventos': '#5fb38a',
        'cat-outros': '#71717a',
      },
      fontFamily: {
        // As variáveis são definidas por `next/font/google` em `src/app/layout.tsx`.
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Cantos levemente arredondados. `md` = controles, `lg` = cards.
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      spacing: {
        sidebar: '16rem', // largura da sidebar fixa
        topbar: '3.5rem', // altura da barra superior no celular
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
        marqueeReverse: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0%)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.3s ease-out forwards',
        marquee: 'marquee 30s linear infinite',
        'marquee-reverse': 'marqueeReverse 30s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
