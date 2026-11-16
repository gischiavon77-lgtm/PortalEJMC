/**
 * Reconsulta de cargo, área e status a cada requisição autenticada.
 *
 * Problema: `role`, `area` e `status` eram gravados no JWT no login e
 * nunca mais conferidos. Um membro desativado ou rebaixado mantinha o
 * acesso até fazer login de novo (ou até o token expirar, em 8h) —
 * contrariando Req 4.6 ("revogar o acesso ... encerrando sessões
 * ativas") e Req 4.8 / 5.4 ("novas permissões a partir da próxima
 * requisição, sem necessidade de logout").
 *
 * Solução: o callback `jwt` de `src/lib/auth.ts` chama
 * `refreshTokenFromDatabase` toda vez que a sessão é lida (`auth()` em
 * páginas, layout e API Routes). A função:
 *
 *   - devolve `null` se o usuário não existe mais ou não está `ACTIVE`.
 *     O NextAuth trata `null` como sessão inválida: `auth()` passa a
 *     devolver `null`, as páginas redirecionam para `/login` e as APIs
 *     respondem 401;
 *   - caso contrário, copia `role`, `area` e `status` do banco para o
 *     token, de modo que rebaixamento/promoção e troca de área valham
 *     já na requisição seguinte.
 *
 * O acesso ao banco é injetado (`loadUser`) para que a regra seja uma
 * função testável sem Prisma (ver `tests/unit/session-refresh.test.ts`)
 * e para que este módulo não puxe o Prisma para quem só quer os tipos.
 *
 * Falha de banco: se `loadUser` lançar (banco fora do ar, timeout), o
 * token é mantido como está, em vez de derrubar a sessão de todos os
 * usuários por uma instabilidade passageira. Nesse cenário as páginas e
 * APIs, que também dependem do banco, já não respondem; a conferência
 * volta a valer na primeira requisição em que o banco responder.
 */

import type { JWT } from 'next-auth/jwt';
import type { AccountStatus, Area, UserRole } from '@prisma/client';

/** Campos de autorização que precisam refletir o banco em tempo real. */
export interface SessionUserState {
  role: UserRole;
  area: Area | null;
  status: AccountStatus;
}

/** Busca o estado atual do usuário; `null` quando ele não existe mais. */
export type SessionUserLoader = (userId: string) => Promise<SessionUserState | null>;

/**
 * Confere o token contra o banco.
 *
 * @returns o token atualizado, ou `null` quando a sessão deve ser
 *          encerrada (usuário removido, desativado, pendente ou rejeitado).
 */
export async function refreshTokenFromDatabase(
  token: JWT,
  loadUser: SessionUserLoader,
): Promise<JWT | null> {
  // Token sem `id` não identifica ninguém: não há o que conferir nem
  // motivo para manter a sessão.
  if (!token.id) {
    return null;
  }

  let current: SessionUserState | null;
  try {
    current = await loadUser(token.id);
  } catch (err) {
    console.error('[auth] Falha ao reconsultar o usuário; mantendo o token atual.', err);
    return token;
  }

  if (!current || current.status !== 'ACTIVE') {
    return null;
  }

  token.role = current.role;
  token.area = current.area;
  token.status = current.status;
  return token;
}
