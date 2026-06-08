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

// 8 horas em segundos. Aplicado a `session.maxAge` e ao guard manual de
// inatividade no callback `jwt` (Task 3.4 / Req 1.1, 1.3). Manter o
// valor numérico aqui (e não em `auth.ts`) garante que tanto o servidor
// Node quanto o middleware Edge usem a mesma janela.
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

// Mesma janela em milissegundos para comparar com `Date.now()` no guard
// manual de inatividade.
const INACTIVITY_LIMIT_MS = SESSION_MAX_AGE_SECONDS * 1000;

/**
 * Configuração compartilhada entre `auth.ts` (Node) e `middleware.ts`
 * (Edge). O tipo `NextAuthConfig` é imposto via `satisfies` para que o
 * TypeScript valide o shape sem alargar o tipo (preservando a inferência
 * literal de campos como `session.strategy: 'jwt'`).
 */
export const authConfig = {
  // Em produção na Vercel, o host é confiável (HTTPS garantido).
  trustHost: true,

  // NextAuth v5 lê `AUTH_SECRET` por padrão; mantemos `NEXTAUTH_SECRET`
  // como alias para compatibilidade com `.env.local.example` (Task 1.10).
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
    // Limite máximo de uma reemissão para a próxima. Combinado com
    // `updateAge = 0` cria a janela rolante exigida pelo Req 1.1.
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Força reemissão a cada chamada do callback `jwt` para impor
    // expiração por inatividade (Req 1.3).
    updateAge: 0,
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
     * Enriquecemos o JWT com `id`, `role`, `area`, `status` na primeira
     * autenticação. Em chamadas subsequentes, atualizamos `lastActivity`
     * e aplicamos o guard de inatividade de 8h (Task 3.4 / Req 1.1, 1.3).
     *
     * Retornar `null` invalida a sessão: o NextAuth descarta o cookie
     * e o middleware redireciona para `/login`.
     */
    async jwt({ token, user }) {
      const now = Date.now();

      if (user) {
        // Login recém-realizado (Credentials.authorize ou Google).
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role as UserRole;
        token.area = (user as { area?: Area | null }).area ?? null;
        token.status = (user as { status?: AccountStatus }).status as AccountStatus;
        token.lastActivity = now;
        return token;
      }

      // Tokens emitidos antes desta task podem não ter `lastActivity`;
      // tratamos como atividade agora para não deslogar usuários no
      // primeiro deploy.
      const lastActivity = typeof token.lastActivity === 'number' ? token.lastActivity : now;

      if (now - lastActivity > INACTIVITY_LIMIT_MS) {
        // 8h sem atividade → sessão expirada. Retornar `null` força o
        // NextAuth a tratar a sessão como inválida.
        return null as unknown as typeof token;
      }

      token.lastActivity = now;
      return token;
    },

    /**
     * Espelha os campos do token na Session para que `useSession()` e
     * `auth()` exponham `id/role/area/status` ao consumidor.
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
