import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Area } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MembrosShell } from '@/components/membros/MembrosShell';
import type { MemberItem } from '@/components/membros/MembersList';

/**
 * `/membros` — Diretório de membros (Tasks 10.2, 10.3, 10.4, 10.5 / Req 11).
 *
 * Server Component que carrega os membros ativos diretamente do
 * Prisma e entrega ao `MembrosShell` client-side. Toda a leitura
 * (filtro por área incluído) acontece no servidor para que a
 * primeira pintura já contenha o dataset correto, sem flash entre
 * "lista completa" e "lista filtrada" — vantagem importante quando
 * o usuário compartilha um link com `?area=...`.
 *
 * ─── Por que ler do Prisma direto e não via `/api/users/members`? ──
 *
 * O API Route (Task 10.1) existe para clientes externos (telas
 * dinâmicas, mobile futura, automações). A página `/membros` está
 * dentro do mesmo processo Node, pode consumir o Prisma sem
 * roundtrip HTTP, e replicar a regra de "ACTIVE + ordenação pt-BR"
 * do route handler é trivial. Mantemos o helper de ordenação
 * `localeCompare` espelhando o da rota — qualquer divergência viola
 * a Property 13 (Task 20.14), então o mesmo cuidado se aplica aos
 * dois pontos de leitura.
 *
 * ─── Filtro por área (Tasks 10.3, 10.4) ────────────────────────────
 *
 * Aceita `?area=<Area>` na URL. Quando ausente (atalho "Todos"),
 * traz todos os ativos. Áreas inválidas degradam para "Todos" (não
 * derrubam a página) — degradação silenciosa aqui é razoável porque
 * o dropdown é controlado e nunca produz valores fora do enum.
 *
 * ─── Empty-state ───────────────────────────────────────────────────
 *
 * O shell decide a mensagem com base em `currentArea`: "não há
 * membros em <Área>" para filtros específicos (Req 11.3) ou uma
 * mensagem genérica quando não há membros ativos no sistema.
 */

const VALID_AREAS = new Set<Area>([
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
]);

function normalizeArea(raw: string | undefined): Area | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (VALID_AREAS.has(upper as Area)) {
    return upper as Area;
  }
  return null;
}

export const metadata: Metadata = {
  title: 'Membros',
  description:
    'Diretório de membros ativos do Portal Interno EJMC — nome, cargo e área.',
};

// Membros mudam quando o admin aprova/rejeita contas ou altera
// dados de cadastro. `force-dynamic` garante que a página reflita
// o estado atual em cada navegação.
export const dynamic = 'force-dynamic';

interface MembrosPageProps {
  searchParams?:
    | Promise<{ area?: string | string[] }>
    | { area?: string | string[] };
}

export default async function MembrosPage(props: MembrosPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Next 15 entrega `searchParams` como Promise; Next 14 entrega
  // como objeto direto. `Promise.resolve` cobre os dois.
  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const rawArea = Array.isArray(search.area) ? search.area[0] : search.area;
  const currentArea = normalizeArea(rawArea);

  const where: { status: 'ACTIVE'; area?: Area } = { status: 'ACTIVE' };
  if (currentArea) {
    where.area = currentArea;
  }

  const dbMembers = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      area: true,
      position: true,
      avatarUrl: true,
    },
  });

  // Re-ordena com `localeCompare` para que nomes com acentos sigam a
  // ordem natural pt-BR. Mesmo critério do API Route — manter
  // espelhado preserva a Property 13.
  const members: MemberItem[] = dbMembers
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      area: m.area,
      position: m.position,
      avatarUrl: m.avatarUrl,
    }));

  return <MembrosShell members={members} currentArea={currentArea} />;
}
