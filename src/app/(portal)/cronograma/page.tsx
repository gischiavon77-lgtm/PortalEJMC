import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import {
  parseMonthKey,
  type CalendarEvent,
} from '@/components/cronograma/calendar-utils';
import { CronogramaShell } from '@/components/cronograma/CronogramaShell';

/**
 * `/cronograma` — Cronograma mensal (Tasks 7.5, 7.6, 7.7, 7.8 e 7.9 / Req 8).
 *
 * Server Component que carrega os eventos do mês selecionado direto do
 * Prisma (mesmo padrão usado em `/dashboard`) e os entrega ao
 * `CronogramaShell` client-side, responsável pela interatividade.
 *
 * ─── Por que Server Component + Prisma direto? ──────────────────────
 *
 * O layout `(portal)/layout.tsx` já garante sessão autenticada via
 * `auth()`. Daí podemos consultar o banco diretamente sem fazer um
 * roundtrip HTTP para `/api/calendar/events`. Vantagens:
 *
 *   - **Sem latência extra**: o helper retorna os dados num único
 *     request RSC, evitando o "fetch interno" que reabriria cookies,
 *     re-resolveria sessão, etc.
 *   - **Cache previsível**: marcamos `dynamic = 'force-dynamic'` para
 *     que cada navegação leia o estado mais recente dos eventos —
 *     consistente com o requisito de visualizar mudanças em até
 *     60 segundos (Req 8.1).
 *   - **Permissões consistentes**: a leitura é aberta a qualquer
 *     usuário autenticado (Req 8.5 — "Membros acessam em modo
 *     leitura"); restrições de mutação são aplicadas pela API e pelo
 *     `usePermission` no shell.
 *
 * ─── Navegação por query string (Task 7.8) ──────────────────────────
 *
 * O mês visível é controlado pelo parâmetro `?month=YYYY-MM`. Quando
 * ausente ou inválido, caímos no mês corrente. O `CronogramaShell`
 * (client) usa `router.push` para alterar essa query e o Next refaz a
 * SSR — assim a fonte da verdade de "qual mês" continua na URL,
 * compartilhável e reproduzível.
 *
 * ─── Empty-state ────────────────────────────────────────────────────
 *
 * Se a consulta não retorna eventos (mês sem agenda), o calendário é
 * renderizado com células vazias. O `CronogramaShell` mostra um
 * pequeno hint para Membros indicando que a visualização é somente
 * leitura — útil quando a primeira impressão é "nada acontece aqui".
 */

export const metadata: Metadata = {
  title: 'Cronograma',
  description: 'Calendário mensal do Portal Interno EJMC.',
};

// O cronograma reflete dados que mudam em segundos (criação por outro
// gestor, sync do Google), então não cacheamos. `force-dynamic` é
// coerente com Req 8.1.
export const dynamic = 'force-dynamic';

interface CronogramaPageProps {
  searchParams?: { month?: string };
}

/**
 * Resolve o mês selecionado a partir da query. Sem fallback agressivo:
 * `?month=2025-99` é tratado como inválido e cai no mês corrente,
 * sem redirecionar — preserva URLs colaveis sem efeitos colaterais.
 */
function resolveSelectedMonth(searchParams?: {
  month?: string;
}): { year: number; month: number } {
  const parsed = parseMonthKey(searchParams?.month);
  if (parsed) return parsed;
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default async function CronogramaPage({
  searchParams,
}: CronogramaPageProps) {
  const { year, month } = resolveSelectedMonth(searchParams);

  // Busca eventos cujo INTERVALO intersecta a janela do mês visível.
  // A grade renderiza 6 semanas (potencialmente cobrindo dias do mês
  // anterior e seguinte), então buscamos um pouco além da janela exata
  // do mês para que eventos exibidos nas linhas de "spillover" também
  // apareçam corretamente.
  //
  // Janela: do dia 1 do mês − 7 dias até o último dia + 7 dias.
  // Trabalhamos com Dates locais aqui — o Prisma cuida da conversão
  // para a coluna `timestamp(3)` do Postgres em UTC.
  const start = new Date(year, month, 1);
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), 1 - 7);
  const rangeEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1 + 7);

  const dbEvents = await prisma.event.findMany({
    where: {
      AND: [
        { startsAt: { lt: rangeEnd } },
        { endsAt: { gt: rangeStart } },
      ],
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      syncStatus: true,
      createdById: true,
    },
  });

  // Serializa as datas para strings ISO — o `CronogramaShell` é um
  // Client Component e queremos passar dados serializáveis (Next.js
  // já faz isso, mas explicitar deixa o contrato visível).
  const events: CalendarEvent[] = dbEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    syncStatus: e.syncStatus,
    createdById: e.createdById,
  }));

  return (
    <CronogramaShell year={year} month={month} events={events} />
  );
}
