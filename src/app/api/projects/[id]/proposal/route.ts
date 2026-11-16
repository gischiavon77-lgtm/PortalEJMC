/**
 * `GET /api/projects/:id/proposal` — Download da proposta comercial (PDF).
 *
 * Restrito a quem tem a permissão `project:readProposal` (Admin e
 * Diretor). Sem login → 401; logado sem permissão → 403.
 *
 * O PDF fica no bucket PRIVADO de propostas do Storage. O cliente
 * informa só o id do projeto; o caminho do arquivo é lido do banco aqui
 * no servidor e nunca é exposto. Não há link direto para o Storage.
 *
 * Cache: `no-store` — é documento restrito, não deve ficar guardado em
 * cache de navegador nem de intermediários.
 */

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { fileNotFoundResponse, fileResponse } from '@/lib/file-response';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface ProposalRouteParams {
  id: string;
}

export const GET = withAuth<ProposalRouteParams>(
  'project:readProposal',
  async (_req: NextRequest, { params }) => {
    const id = params?.id;
    if (!id) {
      return fileNotFoundResponse();
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { proposalPath: true },
    });

    return fileResponse('proposals', project?.proposalPath, {
      cacheControl: 'private, no-store',
      fileName: `proposta-${id}.pdf`,
    });
  },
);
