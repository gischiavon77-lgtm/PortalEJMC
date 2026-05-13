/**
 * Helpers do fluxo Google OAuth — Portal Interno EJMC
 *
 * Task 3.5: resolve (ou cria) a linha em `User` que respaldará uma
 * tentativa de login via Google e classifica o resultado em um único
 * "outcome" para o callback `signIn` em `src/lib/auth.ts` decidir entre
 * permitir o login ou redirecionar para `/login?error=<code>`.
 *
 * ─── Regra de negócio (Req 2.1–2.5, 3.4–3.5) ────────────────────────
 *
 *   1. Procuramos o usuário por email (sempre lowercase, trim).
 *   2. Email novo → cria conta com status `PENDING`, role `MEMBRO`,
 *      `googleId = profile.sub`, `name = profile.name` (fallback: email),
 *      `avatarUrl = profile.picture`. Retorna `kind: 'pending'` para que
 *      o usuário receba a mensagem "aguardando aprovação".
 *   3. Email existente:
 *      - `ACTIVE`   → linka `googleId` (se ainda não existir; e.g. conta
 *                     que se cadastrou por email/senha vinculando-se
 *                     pela primeira vez via Google) e libera o login.
 *      - `PENDING`  → recusa com `kind: 'pending'`.
 *      - `INACTIVE` → recusa com `kind: 'inactive'`.
 *      - `REJECTED` → recusa com `kind: 'rejected'`.
 *
 * ─── Por que não tentamos linkar `googleId` em status diferente de
 *      ACTIVE? ──────────────────────────────────────────────────────
 *   Para contas em estados terminais (REJECTED/INACTIVE) ou aguardando
 *   ação humana (PENDING), preferimos não escrever no banco em todo
 *   pop-up de OAuth: além de evitar I/O sem necessidade, mantemos o
 *   registro do administrador estável até que ele decida o que fazer.
 *   Quando a conta for promovida a `ACTIVE`, o próximo login via
 *   Google linkará o `googleId` automaticamente.
 *
 * ─── Privacidade (Req 1.2 / Property 1) ─────────────────────────────
 *   Diferentemente do fluxo Credentials, onde a Property 1 exige
 *   indistinguibilidade entre "email não existe" e "senha errada", o
 *   fluxo Google **prova posse** do email via OAuth. Portanto é seguro
 *   distinguir os estados (pending/inactive/rejected) — o Google já
 *   verificou que o usuário é dono daquele email.
 *
 * ─── Validação de entrada ──────────────────────────────────────────
 *   `kind: 'invalid'` é retornado quando o profile não traz email ou
 *   `sub`. Isso não deveria acontecer em condições normais (Google
 *   sempre devolve esses claims), mas evitamos criar um registro em
 *   estado inconsistente caso ocorra.
 */

import type { Profile } from 'next-auth';
import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Resultado classificado do fluxo `findOrCreateGoogleUser`.
 *
 *   - `allow`    → login permitido (status ACTIVE).
 *   - `pending`  → conta recém-criada OU já cadastrada e aguardando
 *                  aprovação (status PENDING).
 *   - `inactive` → conta desativada por administrador.
 *   - `rejected` → cadastro recusado por administrador.
 *   - `invalid`  → profile do Google não trouxe email ou `sub`. Ignorado
 *                  pelo callback `signIn` com retorno `false` (AccessDenied).
 */
export type GoogleAuthOutcome =
  | { kind: 'allow'; user: User }
  | { kind: 'pending'; user: User }
  | { kind: 'inactive'; user: User }
  | { kind: 'rejected'; user: User }
  | { kind: 'invalid' };

/**
 * Tamanho máximo do campo `name` em `User` (definido como VarChar(150)
 * no schema Prisma). Truncamos profiles do Google que excedam esse limite
 * para evitar erros de inserção; o usuário pode ajustar depois no perfil.
 */
const NAME_MAX_LENGTH = 150;

/**
 * Resolve ou cria a linha em `User` correspondente à autenticação do
 * Google e classifica o resultado para o callback `signIn`.
 *
 * - Lookup por email (lowercase, trim).
 * - Se não existe, cria com status `PENDING`, role `MEMBRO`, `googleId`
 *   vindo de `profile.sub`, `avatarUrl` vindo de `profile.picture`.
 * - Se existe e está `ACTIVE`, linka o `googleId` quando ainda não houver.
 * - Para demais status, devolve o outcome correspondente sem mutar a linha.
 */
export async function findOrCreateGoogleUser(
  profile: Profile,
): Promise<GoogleAuthOutcome> {
  const email =
    typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
  const sub = typeof profile?.sub === 'string' ? profile.sub : '';

  // Sem email ou sub não há como atrelar a conta com segurança.
  if (!email || !sub) {
    return { kind: 'invalid' };
  }

  const rawName = typeof profile?.name === 'string' ? profile.name.trim() : '';
  const picture = typeof profile?.picture === 'string' ? profile.picture : null;

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    // Email novo: cria conta pendente. Req 2.3 / Task 3.5.
    const created = await prisma.user.create({
      data: {
        email,
        // Fallback para o próprio email se o Google não devolver `name`
        // (claim opcional). Truncamos para o limite do schema.
        name: (rawName.length > 0 ? rawName : email).slice(0, NAME_MAX_LENGTH),
        status: 'PENDING',
        role: 'MEMBRO',
        googleId: sub,
        avatarUrl: picture,
      },
    });
    return { kind: 'pending', user: created };
  }

  switch (existing.status) {
    case 'ACTIVE': {
      // Linka `googleId` na primeira autenticação OAuth de uma conta que
      // foi originalmente cadastrada via email/senha. Idempotente: se já
      // estiver setado, mantemos. Atualizamos `avatarUrl` apenas quando
      // ainda for nulo, para não sobrescrever uma foto definida pelo
      // próprio usuário no /perfil ou /configuracoes.
      if (!existing.googleId) {
        const linked = await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: sub,
            avatarUrl: existing.avatarUrl ?? picture,
          },
        });
        return { kind: 'allow', user: linked };
      }
      return { kind: 'allow', user: existing };
    }
    case 'PENDING':
      return { kind: 'pending', user: existing };
    case 'INACTIVE':
      return { kind: 'inactive', user: existing };
    case 'REJECTED':
      return { kind: 'rejected', user: existing };
    default: {
      // Defensivo: novos status no enum sem mapeamento explícito são
      // tratados como inativos, em vez de permitir acesso indevido.
      const _exhaustive: never = existing.status;
      void _exhaustive;
      return { kind: 'inactive', user: existing };
    }
  }
}
