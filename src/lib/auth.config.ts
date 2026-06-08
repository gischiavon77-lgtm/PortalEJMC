/**
 * NextAuth v5 — configuração base compatível com Edge Runtime.
 *
 * Task 4.3 (split obrigatório para Edge):
 *   O middleware Next.js (`src/middleware.ts`) executa no Edge Runtime,
 *   onde Prisma Client e `bcryptjs` não rodam (dependem de APIs Node).
 *   `src/lib/auth.ts` importa Prisma e bcrypt em Credentials.authorize e
 *   `findOrCreateGoogleUser` no callback `signIn`, então não pode ser
 *   importado por código Edge.
 *
 *   A solução oficial recomendada pelos docs do NextAuth v5
 *   (https://authjs.dev/guides/edge-compatibility) é dividir a config:
 *
 *     1) `auth.config.ts` (este arquivo)  — somente o que é Edge-safe:
 *        callbacks `jwt`/`session`, `pages`, `secret`, `session strategy`.
 *        `providers` fica como lista vazia aqui (placeholder para
 *        satisfazer o `NextAuthConfig`); a lista real é montada em
 *        `auth.ts` quando o NextAuth é instanciado fora do Edge.
 *
 *     2) `auth.ts` — `import { authConfig } from './auth.config'`,
 *        adiciona Credentials + Google + callback `signIn` (que toca o
 *        banco para Google) e exporta `auth/handlers/signIn/signOut`.
 *
 *     3) `middleware.ts` — `import { authConfig }` daqui (sem Prisma /
 *        bcrypt na árvore) e usa `NextAuth(authConfig).auth` para
 *        validar o JWT e proteger rotas.
 *
 *   Os callbacks `jwt` e `session` foram desenhados na Task 3.4 e são
 *   puros sobre `(token, user, session)` — sem I/O — portanto rodam
 *   inalterados no Node e no Edge. Mantê-los aqui (e não em `auth.ts`)
 *   é o que garante que o middleware imponha o guard de inatividade de
 *   8h (Req 1.1, 1.3) usando exatamente a mesma lógica do servidor:
 *   uma única fonte da verdade para a política de sessão.
 *
 *   O callback `signIn` permanece em `auth.ts` porque depende de
 *   `findOrCreateGoogleUser` (Prisma). Isso é seguro: `signIn` só roda
 *   durante o fluxo de OAuth iniciado em route handlers Node — nunca no
 *   Edge — então a ausência dele aqui não enfraquece o middleware.
 */

import type { NextAuthConfig } from 'next-auth';
import type { AccountStatus, Area, UserRole } from '@prisma/client';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 horas

export const authConfig = {
  trustHost: true,

  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 300, // Reemite JWT no máximo a cada 5 minutos
  },

  pages: {
    signIn: '/login',
  },

  // Placeholder para Edge. Os providers reais (Credentials + Google)
  // são adicionados em `auth.ts`, onde Prisma e bcrypt podem rodar.
  // O array vazio satisfaz o tipo `NextAuthConfig` e permite ao
  // middleware decodificar o JWT existente sem precisar dos providers.
  providers: [],

  callbacks: {
    /**
     * JWT ultra-mínimo. Remove campos desnecessários que o NextAuth
     * adiciona por padrão (name, email, picture) para manter o cookie
     * o menor possível e evitar 494 na Vercel.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role as UserRole;
        token.area = (user as { area?: Area | null }).area ?? null;
        token.status = (user as { status?: AccountStatus }).status as AccountStatus;
      }
      // Remove campos que o NextAuth injeta e inflam o cookie
      delete token.name;
      delete token.email;
      delete token.picture;
      delete token.image;
      return token;
    },

    /**
     * Espelha os campos do token na Session.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.area = (token.area as Area | null) ?? null;
        session.user.status = token.status as AccountStatus;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
