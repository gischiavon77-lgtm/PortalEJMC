/**
 * RBAC central — Portal Interno EJMC
 *
 * Task 4.1: matriz de permissões + hierarquia de papéis.
 *
 * Esta task estabelece o **núcleo declarativo** do RBAC. As próximas
 * tasks (4.2–4.5) consomem este módulo:
 *   - 4.2 → `hasPermission` com checagens customizadas (área GP) já
 *           implementada aqui; 4.2 documenta o uso e cobre testes
 *           adicionais conforme novas ações forem incluídas.
 *   - 4.3 → middleware Next.js (`src/middleware.ts`) usa `hasPermission`
 *           para proteger rotas autenticadas e responde 403 quando a
 *           ação requerida não é satisfeita.
 *   - 4.4 → wrapper de API Routes (decorator `withAuth(action)`) usa
 *           `hasPermission` para devolver 403 antes de tocar no handler.
 *   - 4.5 → hook client-side `usePermission()` reutiliza esta matriz
 *           via `session.user` (mesma SSO de verdade que o servidor).
 *
 * ─── Decisões de design ──────────────────────────────────────────────
 *
 * 1) Reaproveitar `UserRole` do Prisma.
 *    O design.md inicial sugeria um `enum PermissionLevel` espelhando
 *    `UserRole`. Manter dois enums idênticos é convite a divergência
 *    silenciosa (um lado adiciona um papel, o outro não). Re-exportamos
 *    o `UserRole` do Prisma como `PermissionLevel` (alias), preservando
 *    a nomenclatura prevista no design sem duplicar a verdade.
 *
 * 2) Hierarquia explícita via `ROLE_LEVEL`.
 *    Mapeamento numérico (ADMIN=5 ... MEMBRO=1) habilita comparações
 *    "≥ X" através de `hasRoleLevel`. É a base para "mínimo de papel"
 *    em ações com escala (ex.: ação X exige Diretor ou superior).
 *
 * 3) Matriz como `Record<Action, UserRole[]>` — lista explícita.
 *    O task descreve duas formas possíveis: "papel mínimo" ou "lista
 *    explícita". Optamos por lista explícita porque algumas ações têm
 *    formatos não-monotônicos na hierarquia: por exemplo, **enquetes**
 *    (poll:create / poll:close) são permitidas a Diretor e Gerente,
 *    **mas não a Coordenador** (Req 16.1, 16.5). Uma lista explícita
 *    elimina a necessidade de "exceções abaixo do mínimo".
 *    Para ações que SÃO monotônicas (ex.: comunicados — Coordenador+),
 *    listamos todos os papéis ≥ Coordenador para tornar a permissão
 *    visualmente óbvia ao ler a matriz.
 *
 * 4) Predicados extras (`PERMISSION_PREDICATES`).
 *    Algumas ações dependem de atributos do usuário além do papel
 *    (notavelmente, pertencer à equipe de Gestão de Pessoas — área).
 *    Em vez de "embutir" essa lógica como `customCheck` por regra,
 *    mantemos um mapa paralelo de predicados opcionais. A combinação
 *    com a matriz é **OU** (any-of):
 *
 *        - Se o papel do usuário ∈ matriz[action]   → permite
 *        - Senão, se predicate(user, context) === true → permite
 *        - Caso contrário → nega
 *
 *    A semântica OU é o que cobre o caso clássico "Diretor+ OU membro
 *    da equipe GP" (ex.: `infraction:delete`, Req 18.7) — Diretores
 *    passam pela matriz, e qualquer membro de GP passa pelo predicado.
 *    Para ações GP-exclusivas (ex.: `infraction:create`, Req 18.1),
 *    a matriz contém apenas ADMIN (override administrativo) e o
 *    predicado força a área GP — assim, um Diretor que NÃO é GP não
 *    consegue registrar infrações, mas qualquer membro de GP sim.
 *
 *    Esse formato declarativo facilita a Property 7 (Task 20.8 —
 *    matriz RBAC): basta percorrer todas as combinações
 *    (role × area × action) e comparar com a especificação.
 *
 * 5) Tipo `Action` como union de string literais.
 *    Garante autocomplete em `hasPermission(user, 'goal:create')` e
 *    impede typos (TypeScript barra `'goal:creat'`). O conjunto reflete
 *    as ações citadas explicitamente nas tasks 6–19; novas ações devem
 *    ser adicionadas aqui antes de ser usadas em código.
 *
 * 6) Argumento `context` em `hasPermission`.
 *    Por enquanto, apenas `area` é consumido (para predicados GP).
 *    Estruturamos como objeto opcional para crescer sem quebrar a API
 *    (ex.: futuramente, `context.targetUserId` para ações sobre
 *    outros usuários, ou `context.projectId` para projetos privados).
 */

import type { Area, UserRole } from '@prisma/client';

/**
 * Alias de `UserRole` mantido pelo design.md ("enum PermissionLevel").
 * A verdade vive no Prisma para evitar divergência (ver decisão 1).
 *
 * Reexportamos o tipo (não o valor) porque `UserRole` é um enum runtime
 * gerado pelo `@prisma/client` — para consumir em código de domínio
 * basta o tipo. Quando precisar dos valores em runtime, importe o
 * `UserRole` diretamente do Prisma.
 */
export type PermissionLevel = UserRole;

/**
 * Hierarquia numérica dos papéis. Quanto maior o número, mais
 * privilegiado. Usada por `hasRoleLevel` para checagens "≥ X".
 *
 * O Prisma gera `UserRole` como string-enum, então este `Record` precisa
 * cobrir todos os valores possíveis (TypeScript valida exaustividade
 * porque o tipo do índice é o próprio enum).
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 5,
  DIRETOR: 4,
  GERENTE: 3,
  COORDENADOR: 2,
  MEMBRO: 1,
};

/**
 * Conjunto fechado de ações conhecidas pelo RBAC.
 *
 * Convenção: `<recurso>:<verbo>` (kebab-case minúsculo). Verbos de uso
 * comum: `create`, `update`, `delete`, `write` (cobre create+update),
 * `manage` (CRUD completo + estados), `approve`, `close`,
 * `updateProgress`, `updateStatus`.
 *
 * Lista alinhada com o escopo descrito no Task 4.1 e no design.md.
 * Adicionar novas ações exige duas alterações coordenadas:
 *   1) acrescentar o literal aqui;
 *   2) cadastrar a ação em `PERMISSION_MATRIX` (e em
 *      `PERMISSION_PREDICATES`, se aplicável).
 * O TypeScript falha o build se uma ação for usada sem aparecer aqui.
 */
export type Action =
  // Cronograma (Req 8) — Coordenador+ pode criar/editar/excluir eventos.
  | 'calendar:create'
  | 'calendar:update'
  | 'calendar:delete'
  // Metas (Req 9) — Diretor+ cria e atualiza progresso.
  | 'goal:create'
  | 'goal:updateProgress'
  // KPIs (Req 10) — `kpi:write` cobre a configuração administrativa
  // (criação/edição de indicadores) e é exclusiva do Admin (Req 10.5).
  // `kpi:writeValue` cobre o registro de valores por membros da área
  // do KPI (Req 10.1, 10.2): admins via matriz, demais via predicado
  // de mesma-área (`context.area`).
  | 'kpi:write'
  | 'kpi:writeValue'
  // Membros (Req 11) — gestão administrativa do diretório.
  | 'member:manage'
  // Comunicados (Req 15) — Coordenador+ publica.
  | 'announcement:create'
  // Enquetes (Req 16) — Diretor/Gerente criam e encerram (não-monotônico).
  | 'poll:create'
  | 'poll:close'
  // Pontuação / Infrações (Req 18) — equipe GP + Diretor+.
  | 'infraction:create'
  | 'infraction:delete'
  // Projetos (Req 14) — somente Admin altera status.
  | 'project:updateStatus'
  // Portfólio de serviços (Req 13) — Admin/Diretor mantêm o catálogo.
  | 'service:write'
  // Administração de usuários (Req 4) — Admin gerencia, aprova, cria.
  | 'user:manage'
  | 'user:approve'
  | 'user:create'
  // Acesso ao módulo de administração — usado pelo middleware da Task 4.3
  // e pela visibilidade do menu (Property 8 / Req 5.3).
  | 'admin:access';

/**
 * Lista de papéis autorizados por ação. A presença de um papel aqui
 * concede permissão **direta** (sem necessidade de checagem extra).
 *
 * ADMIN aparece em quase todas as ações como override consciente:
 * preserva a "regra do administrador supremo" sem espalhar o
 * `if (role === 'ADMIN') return true` por toda a aplicação. Essa
 * decisão é coerente com o Req 5.1 ("Administrador — acesso total").
 *
 * Atenção: para ações que dependem **exclusivamente** de um atributo
 * do usuário (caso típico de GP-only), a matriz contém apenas o
 * override ADMIN; a permissão real vem do predicado correspondente.
 */
export const PERMISSION_MATRIX: Record<Action, UserRole[]> = {
  // ─── Cronograma (Coordenador+, Req 8.2-8.4) ────────────────────────
  'calendar:create': ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR'],
  'calendar:update': ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR'],
  'calendar:delete': ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR'],

  // ─── Metas (Diretor+, Req 9.1, 9.3) ────────────────────────────────
  'goal:create': ['ADMIN', 'DIRETOR'],
  'goal:updateProgress': ['ADMIN', 'DIRETOR'],

  // ─── KPIs (Req 10) ─────────────────────────────────────────────────
  // Configuração de indicadores — Admin apenas (Req 10.5).
  // A inserção de valores por usuário da área é uma ação derivada que
  // será modelada na Task 9 (ex.: `kpi:writeOwnArea` com predicado de
  // mesma-área). Aqui, `kpi:write` cobre operações de configuração.
  'kpi:write': ['ADMIN'],
  // Registro de valores — Admin via matriz; demais (Diretor/Gerente/
  // Coordenador/Membro) entram pelo predicado quando pertencem à
  // mesma área do KPI alvo. Para KPIs globais (`area === null` no
  // contexto), apenas Admin grava — coerente com Req 10.1 ("cada
  // Usuário autorizado visualize e registre apenas os KPIs da sua
  // própria Área").
  'kpi:writeValue': ['ADMIN'],

  // ─── Diretório de membros (Admin, Req 4) ───────────────────────────
  'member:manage': ['ADMIN'],

  // ─── Comunicados (Coordenador+, Req 15.2) ──────────────────────────
  'announcement:create': ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR'],

  // ─── Enquetes (Diretor + Gerente, Req 16.1, 16.5, 16.6) ────────────
  // Coordenador NÃO entra (regra não-monotônica deliberada).
  'poll:create': ['ADMIN', 'DIRETOR', 'GERENTE'],
  'poll:close': ['ADMIN', 'DIRETOR', 'GERENTE'],

  // ─── Pontuação (Req 18) ────────────────────────────────────────────
  // Registro: somente equipe GP (Req 18.1) — qualquer papel desde que
  // pertença à área GESTAO_PESSOAS. ADMIN como override administrativo.
  'infraction:create': ['ADMIN'],
  // Exclusão: equipe GP OU Diretor+ (Req 18.7). Diretor/Admin entram
  // pela matriz; demais membros de GP passam pelo predicado.
  'infraction:delete': ['ADMIN', 'DIRETOR'],

  // ─── Projetos (Admin, Req 14.4) ────────────────────────────────────
  'project:updateStatus': ['ADMIN'],

  // ─── Portfólio (Admin/Diretor, Req 13.3) ───────────────────────────
  'service:write': ['ADMIN', 'DIRETOR'],

  // ─── Administração de usuários (Admin, Req 4) ──────────────────────
  'user:manage': ['ADMIN'],
  'user:approve': ['ADMIN'],
  'user:create': ['ADMIN'],

  // ─── Página de administração (Admin, Req 4.1) ──────────────────────
  'admin:access': ['ADMIN'],
};

/**
 * Identidade mínima para checagem de permissão. Aceitamos um shape
 * estrutural (não o `User` completo do Prisma) para que a função sirva
 * tanto à `Session.user` (cliente) quanto a registros do banco (servidor).
 */
export interface PermissionUser {
  role: UserRole;
  area?: Area | null;
}

/**
 * Contexto opcional consumido por predicados. Hoje só `area` é usado
 * (para checagens de mesma-área), mas crescer este objeto não quebra
 * chamadas existentes.
 */
export interface PermissionContext {
  area?: Area | null;
}

/**
 * Predicados extras por ação. Avaliados como **OU** em relação à matriz
 * de papéis (decisão 4). Predicados puros: nada de I/O ou efeitos
 * colaterais — eles devem ser determinísticos para `(user, context)`.
 *
 * `Partial`: nem toda ação tem predicado. Ações sem predicado dependem
 * exclusivamente da matriz.
 */
export const PERMISSION_PREDICATES: Partial<
  Record<Action, (user: PermissionUser, context?: PermissionContext) => boolean>
> = {
  // Req 18.1 — qualquer membro da equipe de Gestão de Pessoas pode
  // registrar infrações, independentemente do papel hierárquico.
  'infraction:create': (user) => user.area === 'GESTAO_PESSOAS',
  // Req 18.7 — exclusão também é permitida a membros GP (além de
  // Diretor+ via matriz).
  'infraction:delete': (user) => user.area === 'GESTAO_PESSOAS',

  // Req 10.1, 10.2 — usuários autorizados registram valores apenas
  // dos KPIs da sua própria área. O `context.area` deve ser fornecido
  // pelo chamador (rota `POST /api/kpis/:id/values` resolve o KPI
  // antes de chamar `requirePermission`). KPIs globais (sem área)
  // ficam restritos ao Admin via matriz.
  'kpi:writeValue': (user, context) => {
    if (!context?.area) return false;
    return user.area === context.area;
  },
};

/**
 * Compara o papel `role` contra um papel mínimo `requiredRole` usando a
 * hierarquia numérica de `ROLE_LEVEL`.
 *
 * Útil para checagens ad-hoc que não estão na matriz (ex.: filtros de
 * visibilidade de metas — Req 9.7 — que dizem "Diretor ou Admin vê
 * todas as áreas"). Para decisões de permissão "oficiais", prefira
 * `hasPermission(action)` para manter a matriz como fonte da verdade.
 */
export function hasRoleLevel(
  role: UserRole,
  requiredRole: UserRole,
): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[requiredRole];
}

/**
 * Decisão central de autorização. Retorna `true` quando o usuário tem
 * permissão para executar `action`, considerando:
 *
 *   1. A lista explícita de papéis em `PERMISSION_MATRIX[action]`.
 *   2. O predicado opcional em `PERMISSION_PREDICATES[action]`.
 *
 * Combinação: **OU** (qualquer um dos dois habilita a ação).
 *
 * Ações desconhecidas (não cadastradas na matriz) são tratadas como
 * **deny por padrão** — fechado-por-padrão é a postura segura para
 * RBAC. Se o TypeScript permitiu a chamada, é porque a ação está em
 * `Action`, então o cenário "desconhecida" só ocorreria por bug em
 * `PERMISSION_MATRIX`. Ainda assim, mantemos a guarda defensiva.
 *
 * A função é pura/sincrona e não toca em I/O — é seguro chamar em
 * qualquer camada (Server Component, API Route, middleware, hook).
 */
export function hasPermission(
  user: PermissionUser,
  action: Action,
  context?: PermissionContext,
): boolean {
  const allowedRoles = PERMISSION_MATRIX[action];

  // Defesa contra ações sem entrada na matriz (não deveria acontecer
  // graças ao `Record<Action, UserRole[]>`, mas o TS não consegue
  // provar a integridade em runtime se a matriz for mutada).
  if (allowedRoles && allowedRoles.includes(user.role)) {
    return true;
  }

  const predicate = PERMISSION_PREDICATES[action];
  if (predicate && predicate(user, context)) {
    return true;
  }

  return false;
}
