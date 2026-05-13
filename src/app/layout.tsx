import type { Metadata } from 'next';
import { DM_Mono, DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';

/**
 * Tipografia do design system (referência: login.html).
 * - Playfair Display: títulos (serif elegante)
 * - DM Sans: corpo / UI
 * - DM Mono: dados tabulares e ocasionais
 */
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Portal Interno EJMC',
  description: 'Portal interno da EJMC — gestão centralizada da empresa júnior',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} ${dmMono.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
