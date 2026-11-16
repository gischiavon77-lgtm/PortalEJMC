import type { Metadata } from 'next';
import { League_Spartan, Montserrat } from 'next/font/google';

import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';

/**
 * Fontes da identidade EJMC, carregadas por `next/font/google` (o Next
 * baixa e hospeda os arquivos no build; o navegador não consulta o Google).
 *
 *   - League Spartan → títulos (`font-heading`): brancos, em negrito.
 *   - Montserrat     → todo o restante (`font-body`): nunca em maiúsculas.
 *
 * Cada fonte expõe uma CSS variable, consumida por `tailwind.config.ts`
 * e por `globals.css`.
 */
const headingFont = League_Spartan({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const bodyFont = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Portal Interno EJMC',
  description: 'Plataforma de gestão interna da Empresa Júnior de Matemática e Computação',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="bg-bg font-body text-text">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
