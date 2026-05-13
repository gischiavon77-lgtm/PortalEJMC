'use client';

/**
 * usePermission — verificação client-side de permissão (Task 4.5).
 *
 * Hook React que consulta a sessão atual via `useSession()` do
 * `next-auth/react` e delega a decisão de autorização ao núcleo RBAC
 * em `src/lib/permissions.ts`. Mantemos o RBAC como **fonte única da
 * verdade** entre cliente e servidor: o middleware (Task 4.3), o
 * wrapper de API Routes (Task 4.4) e este hook chamam exatamente a
 * mesma função `hasPermission`. Assim, divergências entre UI e
 * backend ficam estruturalmente impossíveis.
 *
 * ─── Por que `permissions.ts` é seguro para o bundle do navegador? ──
 *
 * O módulo importa apenas **tipos** de `@prisma/client`
 * (`import type { Area, UserRole } from '@prisma/client'`), que são
 * apagados em tempo de compilação pelo TypeScript. Não há nenhum
 * `import` de runtime do Prisma, bcrypt, fs, db ou qualquer API
 * Node-only. Toda a lógica é pura/sincrona sobre o objeto
 * `PermissionUser` (`{ role, area? }`). Portanto, é correto e
 * suportado importá-lo de um arquivo `'use client'`.
 *
 * ─── Contrato do hook ───────────────────────────────────────────────
 *
 * `usePermission(action, context?)` retorna `{ allowed, isLoading }`:
 *
 *   - `isLoading` reflete o status da sessão (`'loading'` enquanto o
 *     NextAuth resolve `/api/auth/session` no primeiro mount).
 *     Componentes devem tratar esse estado para não "piscar" UI
 *     restrita antes da hidratação.
 *
 *   - `allowed` é `false` enquanto carrega ou se não há sessão. Esse
 *     default fechado garante que botões protegidos por permissão
 *     fiquem desabilitados até a confirmação — alinhado ao Req 5.2
 *     ("não revelar detalhes sobre a funcionalidade protegida")
 *     e à postura "deny-by-default" do RBAC.
 *
 *   - Quando autenticado, `allowed = hasPermission(user, action, context)`.
 *
 * ─── Por que aceitar `context`? ─────────────────────────────────────
 *
 * Algumas ações (ex.: `infraction:create`) dependem de atributos do
 * usuário; o predicado em `permissions.ts` consome
 * `(user, context?)`. Por padrão, a `area` do usuário já vai como
 * parte de `PermissionUser`, mas o segundo argumento permite
 * decisões dinâmicas em UI (ex.: "este botão refere-se à minha área?")
 * sem reconfigurar o RBAC. Hoje só `area` é consumida; futuros
 * atributos (alvo, projeto, etc.) podem ser adicionados sem quebrar
 * chamadas existentes.
 *
 * Importante: este hook NÃO substitui a checagem servidor-side. Ele
 * existe apenas para esconder/desabilitar elementos de UI (Property 8
 * / Req 5.3). Toda mutação de estado deve ser revalidada no servidor.
 */

import { useSession } from 'next-auth/react';
import type { UserRole } from '@prisma/client';

import {
  type Action,
  type PermissionContext,
  type PermissionUser,
  hasPermission,
  hasRoleLevel,
} from '@/lib/permissions';

interface PermissionResult {
  /**
   * `true` somente quando há sessão autenticada e o RBAC concede a
   * ação. `false` durante o carregamento ou quando não há sessão.
   */
  allowed: boolean;
  /**
   * `true` enquanto a sessão está sendo resolvida pelo NextAuth.
   * Útil para evitar flicker em botões/itens condicionais.
   */
  isLoading: boolean;
}

/**
 * Verifica se o usuário autenticado pode executar `action`.
 *
 * @param action  Ação registrada em `PERMISSION_MATRIX` (autocomplete
 *                garantido pelo tipo `Action`).
 * @param context Contexto opcional para predicados dinâmicos
 *                (atualmente só `area`).
 */
export function usePermission(
  action: Action,
  context?: PermissionContext,
): PermissionResult {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  // Sem sessão (deslogado, expirada, ou ainda carregando), negamos.
  // Esta postura "fechada" é deliberada — preferimos esconder uma
  // ação válida por um frame a expor brevemente uma proibida.
  if (!session?.user) {
    return { allowed: false, isLoading };
  }

  const permissionUser: PermissionUser = {
    role: session.user.role,
    area: session.user.area,
  };

  return {
    allowed: hasPermission(permissionUser, action, context),
    isLoading,
  };
}

/**
 * Helper para checagens hierárquicas que não correspondem a uma ação
 * específica do RBAC. Útil em filtros de visibilidade (ex.: Req 9.7 —
 * "Diretor ou Admin vê todas as áreas") onde o componente precisa
 * apenas saber se o papel está acima de um patamar mínimo.
 *
 * Para decisões sensíveis a "fazer algo", prefira `usePermission(action)`
 * — a matriz de ações é a fonte oficial e cobre regras não-monotônicas
 * (ex.: enquetes que pulam Coordenador).
 */
export function useHasRole(requiredRole: UserRole): PermissionResult {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  if (!session?.user) {
    return { allowed: false, isLoading };
  }

  return {
    allowed: hasRoleLevel(session.user.role, requiredRole),
    isLoading,
  };
}
