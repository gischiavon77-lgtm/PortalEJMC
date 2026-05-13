/**
 * Helpers de dados do módulo Dashboard (Task 6).
 *
 * Centraliza as consultas Prisma usadas tanto pela página
 * `/dashboard` (Task 6.3 — Server Component que chama Prisma direto
 * para evitar round-trip HTTP durante o SSR) quanto pelas API Routes
 * `GET /api/dashboard` (Task 6.1) e `GET /api/dashboard/activities`
 * (Task 6.2). Manter as duas surfaces (HTTP + RSC) consumindo o
 * mesmo helper garante que os números exibidos na UI batem com o
 * que clientes externos veem via API.
 *
 * ─── Decisões de design ─────────────────────────────────────────────
 *
 * 1) **Fallback "zero / lista vazia" embutido (Req 7.8 / Task 6.5).**
 *    Cada função roda dentro de um `try/catch` próprio. Falhas
 *    inesperadas (Prisma indisponível, KPI não cadastrado, schema
 *    desatualizado) são logadas no servidor e convertidas em valor
 *    zero (indicador) ou lista vazia (atividades). Isso preserva a
 *    UX requerida pelo Req 7.8 — o dashboard sempre carrega, mesmo
 *    com dados parciais — e mantém a página resistente a indisponi-
 *    bilidades pontuais de fontes específicas (ex.: KPI ainda não
 *    cadastrado pela equipe Adm-Fin).
 *
 * 2) **KPIs lookadas por *nome* (sem novos modelos).**
 *    Os indicadores numéricos do dashboard (faturamento mensal, meta
 *    de faturamento, leads) não têm modelo dedicado no schema atual
 *    (Task 2). A escolha mais conservadora é reaproveitar o modelo
 *    `Kpi`/`KpiValue` já existente (Task 2.4 / Task 9): cadastra-se
 *    um KPI com nome "Faturamento Mensal", "Meta de Faturamento" e
 *    "Leads", e o helper consulta o valor mais recente do mês
 *    corrente. Quando não há valor no mês, retorna `0` — alinhado
 *    com Req 7.4/7.5/7.6 ("acumulado do mês corrente") e o fallback
 *    da Req 7.8.
 *
 *    A busca do KPI por nome é case-insensitive (`mode: 'insensitive'`)
 *    e tolerante a múltiplos KPIs com o mesmo nome em áreas
 *    diferentes — pegamos o primeiro encontrado por ordem de criação
 *    (`createdAt asc`). Esse trade-off é aceitável: se a empresa
 *    cadastrar dois KPIs "Faturamento" em áreas distintas, o
 *    dashboard exibe o do KPI mais antigo, com nome estável. Quando
 *    a Task 9 introduzir uma forma canônica de "faturamento global",
 *    podemos restringir aqui.
 *
 * 3) **"Mês corrente" = janela `[firstOfMonth, firstOfNextMonth)`.**
 *    Calculamos a janela uma vez por chamada para que todas as
 *    queries usem os mesmos limites — útil para reproduzibilidade
 *    em testes e para evitar discrepâncias (mês muda durante a
 *    execução). Usamos UTC consistentemente (`Date.UTC`) — é o que
 *    bate com como `DateTime` é gravado no Postgres pela default
 *    `now()` do Prisma e evita drift por timezone do servidor.
 *
 * 4) **Atividades = união de fontes existentes.**
 *    O Req 7.7 fala em "atividades programadas para o mês corrente".
 *    Não há modelo `Activity` no schema; o helper deriva uma feed
 *    unificada a partir de:
 *
 *      - `Event`        → "Cronograma" (eventos sincronizados com
 *                         Google Calendar);
 *      - `Announcement` → "Comunicado" publicado no mural;
 *      - `ProjectStatusHistory` → "Projeto" mudou de status;
 *      - `GoalUpdate`   → "Meta" teve progresso atualizado.
 *
 *    Cada fonte é normalizada para `{ id, type, title, timestamp }`,
 *    a união é ordenada por `timestamp desc` (mais recente primeiro)
 *    — Req 7.7 pede ordem cronológica; "mais recente primeiro" é a
 *    convenção do design.md (mural, KPIs, projetos…) — e limitada a
 *    10 itens. Cada fonte busca apenas seus próprios 10 mais recentes
 *    do mês para evitar puxar o histórico inteiro só para depois
 *    descartar 95%.
 *
 *    Note que para `Event` o "timestamp" é `startsAt` (data de início
 *    do evento), porque é o que define a cronologia de "atividade"
 *    do ponto de vista do usuário; para os demais é o `createdAt` ou
 *    `changedAt` que indica quando a coisa "aconteceu".
 *
 *    O id de cada atividade recebe um prefixo do tipo
 *    (`event:`, `announcement:`, `project-status:`, `goal-update:`)
 *    para que a UI possa usar `id` como `key` do React sem risco de
 *    colisão entre os modelos (ids do Prisma são `cuid`, mas uma
 *    `Announcement` e um `Event` poderiam — ainda que improvável —
 *    compartilhar o mesmo cuid; o prefixo elimina o risco e ainda
 *    serve como discriminator de domínio).
 *
 * 5) **Tipo de retorno serializável.**
 *    O `Kpi.value` no banco é `Decimal(10,2)`. Aqui sempre devolvemos
 *    `number` (via `.toNumber()`/`Number(...)`) porque
 *    a) a página pode ser um Server Component que serializa o resultado
 *       para o cliente (e `Decimal` quebra a serialização do RSC);
 *    b) os indicadores são exibidos com formatação local (`Intl.NumberFormat`),
 *       que não trabalha com `Decimal` direto.
 *    A perda de precisão a partir de R$ 2^53 é inalcançável para os
 *    valores de faturamento de uma EJ (a meta gira na casa de
 *    centenas de milhares por mês).
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/** Resposta da API `GET /api/dashboard`. */
export interface DashboardSummary {
  /** Quantidade de usuários com `status = ACTIVE` (Req 7.1). */
  activeMembers: number;
  /** Projetos com `status = EM_ANDAMENTO` (Req 7.2). */
  projectsInProgress: number;
  /** Projetos com `status = CONGELADO` (Req 7.3). */
  projectsFrozen: number;
  /** Faturamento acumulado do mês em R$ (Req 7.4). */
  monthlyRevenue: number;
  /** Meta de faturamento do mês em R$ (Req 7.5). */
  revenueGoal: number;
  /** Quantidade de leads registrados no mês (Req 7.6). */
  monthlyLeads: number;
}

/** Tipos discriminantes da feed de atividades (Req 7.7). */
export type DashboardActivityType =
  | 'event'
  | 'announcement'
  | 'project-status'
  | 'goal-update';

/** Item normalizado da feed de atividades. */
export interface DashboardActivity {
  /** `<tipo>:<cuid>` para evitar colisão entre modelos. */
  id: string;
  type: DashboardActivityType;
  /** Título humanizado (já em pt-BR, pronto para exibir). */
  title: string;
  /**
   * Subtítulo opcional — usado para enriquecer com contexto
   * (autor do comunicado, mudança de status, etc.). `null` quando
   * não houver complemento útil.
   */
  detail: string | null;
  /** ISO 8601 (string). RSC-safe. */
  timestamp: string;
}

/** Limite de itens da feed (Req 7.7). */
const ACTIVITY_LIMIT = 10;

/** Nomes (case-insensitive) dos KPIs consumidos pelo dashboard. */
const KPI_NAMES = {
  monthlyRevenue: 'Faturamento Mensal',
  revenueGoal: 'Meta de Faturamento',
  monthlyLeads: 'Leads',
} as const;

/**
 * Calcula `[firstOfMonth, firstOfNextMonth)` para "agora", em UTC.
 * Exportada apenas para testes — uso normal: chame os helpers de
 * mais alto nível, que delegam internamente.
 */
export function getCurrentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Lê o valor mais recente do KPI cujo nome bate (case-insensitive)
 * com `name`, restrito ao mês corrente. Devolve `0` quando o KPI não
 * existe, não tem valor no mês, ou quando a query falha — Req 7.8.
 */
async function readMonthlyKpiValue(
  name: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<number> {
  try {
    const value = await prisma.kpiValue.findFirst({
      where: {
        recordedAt: { gte: monthStart, lt: monthEnd },
        kpi: {
          name: { equals: name, mode: 'insensitive' },
        },
      },
      orderBy: { recordedAt: 'desc' },
      select: { value: true },
    });

    if (!value) return 0;

    // `value` é `Prisma.Decimal`. `.toNumber()` ou Number(toFixed)
    // ambos são seguros para os ranges esperados (ver decisão 5).
    if (value.value instanceof Prisma.Decimal) {
      return value.value.toNumber();
    }
    return Number(value.value);
  } catch (err) {
    console.error(`[dashboard] Falha ao ler KPI "${name}":`, err);
    return 0;
  }
}

/**
 * Resolve os 6 indicadores numéricos do dashboard. Cada métrica é
 * isolada em seu próprio `try/catch` (via `Promise.allSettled`) para
 * que uma falha em uma fonte (ex.: KPI Faturamento ainda não
 * cadastrado) não prejudique as outras.
 */
export async function getDashboardSummary(now: Date = new Date()): Promise<DashboardSummary> {
  const { start, end } = getCurrentMonthRange(now);

  const tasks = [
    safeCount(() => prisma.user.count({ where: { status: 'ACTIVE' } })),
    safeCount(() => prisma.project.count({ where: { status: 'EM_ANDAMENTO' } })),
    safeCount(() => prisma.project.count({ where: { status: 'CONGELADO' } })),
    readMonthlyKpiValue(KPI_NAMES.monthlyRevenue, start, end),
    readMonthlyKpiValue(KPI_NAMES.revenueGoal, start, end),
    readMonthlyKpiValue(KPI_NAMES.monthlyLeads, start, end),
  ] as const;

  const [activeMembers, projectsInProgress, projectsFrozen, monthlyRevenue, revenueGoal, monthlyLeads] =
    await Promise.all(tasks);

  return {
    activeMembers,
    projectsInProgress,
    projectsFrozen,
    monthlyRevenue,
    revenueGoal,
    monthlyLeads,
  };
}

/**
 * Wrapper de contagem com fallback para 0 — usado para que uma falha
 * pontual em `count()` não estoure o helper inteiro.
 */
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    console.error('[dashboard] Falha em count():', err);
    return 0;
  }
}

/**
 * Atividades do mês corrente (Req 7.7). Combina eventos do
 * cronograma, comunicados, mudanças de status de projetos e
 * atualizações de progresso de metas; ordena por `timestamp` desc;
 * limita a 10 itens.
 */
export async function getDashboardActivities(
  now: Date = new Date(),
): Promise<DashboardActivity[]> {
  const { start, end } = getCurrentMonthRange(now);

  // Consultamos cada fonte com `take: ACTIVITY_LIMIT` para limitar
  // o tráfego — depois unimos e pegamos os 10 mais recentes da união.
  const [events, announcements, projectChanges, goalUpdates] = await Promise.all([
    safeFindMany(() =>
      prisma.event.findMany({
        where: { startsAt: { gte: start, lt: end } },
        orderBy: { startsAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          title: true,
          startsAt: true,
        },
      }),
    ),
    safeFindMany(() =>
      prisma.announcement.findMany({
        where: { createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      }),
    ),
    safeFindMany(() =>
      prisma.projectStatusHistory.findMany({
        where: { changedAt: { gte: start, lt: end } },
        orderBy: { changedAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          changedAt: true,
          project: { select: { name: true } },
        },
      }),
    ),
    safeFindMany(() =>
      prisma.goalUpdate.findMany({
        where: { createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          newProgress: true,
          createdAt: true,
          goal: { select: { name: true } },
        },
      }),
    ),
  ]);

  const merged: DashboardActivity[] = [
    ...events.map<DashboardActivity>((e) => ({
      id: `event:${e.id}`,
      type: 'event',
      title: e.title,
      detail: 'Evento no cronograma',
      timestamp: e.startsAt.toISOString(),
    })),
    ...announcements.map<DashboardActivity>((a) => ({
      id: `announcement:${a.id}`,
      type: 'announcement',
      title: a.title,
      detail: a.author?.name ? `Por ${a.author.name}` : 'Comunicado publicado',
      timestamp: a.createdAt.toISOString(),
    })),
    ...projectChanges.map<DashboardActivity>((c) => ({
      id: `project-status:${c.id}`,
      type: 'project-status',
      title: c.project?.name ?? 'Projeto',
      detail: formatStatusChange(c.oldStatus, c.newStatus),
      timestamp: c.changedAt.toISOString(),
    })),
    ...goalUpdates.map<DashboardActivity>((u) => ({
      id: `goal-update:${u.id}`,
      type: 'goal-update',
      title: u.goal?.name ?? 'Meta',
      detail: `Progresso atualizado para ${u.newProgress}%`,
      timestamp: u.createdAt.toISOString(),
    })),
  ];

  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return merged.slice(0, ACTIVITY_LIMIT);
}

/**
 * Wrapper de leitura em lote com fallback para `[]` — segue a mesma
 * lógica de `safeCount`, isolando falhas por fonte.
 */
async function safeFindMany<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error('[dashboard] Falha em findMany():', err);
    return [];
  }
}

/**
 * Formata uma mudança de status de projeto para a feed de atividades.
 * Usa rótulos pt-BR coerentes com o dropdown da página de Projetos
 * (Task 13). Quando `oldStatus` é `null` (criação inicial), exibe
 * apenas o novo status.
 */
function formatStatusChange(
  oldStatus: string | null,
  newStatus: string,
): string {
  const label = (status: string) => {
    switch (status) {
      case 'EM_ANDAMENTO':
        return 'Em andamento';
      case 'CONCLUIDO':
        return 'Concluído';
      case 'CONGELADO':
        return 'Congelado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (!oldStatus) {
    return `Status definido como ${label(newStatus)}`;
  }
  return `${label(oldStatus)} → ${label(newStatus)}`;
}
