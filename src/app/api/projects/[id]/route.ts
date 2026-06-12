/**
 * `PATCH /api/projects/:id` — Atualiza um projeto (Admin/Diretor).
 * `DELETE /api/projects/:id` — Remove um projeto (Admin/Diretor).
 *
 * PATCH aceita multipart/form-data com campos opcionais:
 *   - name, ferramenta, progress, team, price, proposal
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MAX_PROPOSAL_SIZE = 10 * 1024 * 1024; // 10MB

interface ProjectRouteParams {
  id: string;
}

function notFoundResponse(): Response {
  return NextResponse.json(
    { error: true, code: 'NOT_FOUND', message: 'Projeto não encontrado.' },
    { status: 404 },
  );
}

// ─── PATCH ───────────────────────────────────────────────────────────

async function patchHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: ProjectRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) return notFoundResponse();

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFoundResponse();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'BAD_REQUEST',
        message: 'Corpo da requisição inválido. Envie como multipart/form-data.',
      },
      { status: 400 },
    );
  }

  const errors: Array<{ path: string; message: string }> = [];
  const data: Record<string, unknown> = {};

  // Name
  const nameField = formData.get('name');
  if (nameField !== null) {
    const name = (nameField as string).trim();
    if (!name) {
      errors.push({ path: 'name', message: 'Nome é obrigatório.' });
    } else if (name.length > 200) {
      errors.push({ path: 'name', message: 'Nome deve ter no máximo 200 caracteres.' });
    } else {
      data.name = name;
    }
  }

  // Ferramenta
  const ferramentaField = formData.get('ferramenta');
  if (ferramentaField !== null) {
    const ferramenta = (ferramentaField as string).trim();
    if (!ferramenta) {
      errors.push({ path: 'ferramenta', message: 'Ferramenta é obrigatória.' });
    } else if (ferramenta.length > 200) {
      errors.push({ path: 'ferramenta', message: 'Ferramenta deve ter no máximo 200 caracteres.' });
    } else {
      data.ferramenta = ferramenta;
    }
  }

  // Progress
  const progressField = formData.get('progress');
  if (progressField !== null) {
    const progress = parseInt(progressField as string, 10);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      errors.push({ path: 'progress', message: 'Progresso deve ser um número entre 0 e 100.' });
    } else {
      data.progress = progress;
    }
  }

  // Team
  const teamField = formData.get('team');
  if (teamField !== null) {
    data.team = (teamField as string).trim();
  }

  // Price
  const priceField = formData.get('price');
  if (priceField !== null) {
    const price = parseFloat(priceField as string);
    if (isNaN(price) || price < 0) {
      errors.push({ path: 'price', message: 'Preço deve ser um número positivo.' });
    } else {
      data.price = price;
    }
  }

  // Proposal file
  const proposalFile = formData.get('proposal') as File | null;
  if (proposalFile && proposalFile.size > 0) {
    if (proposalFile.type !== 'application/pdf') {
      errors.push({ path: 'proposal', message: 'A proposta deve ser um arquivo PDF.' });
    } else if (proposalFile.size > MAX_PROPOSAL_SIZE) {
      errors.push({ path: 'proposal', message: 'O arquivo da proposta deve ter no máximo 10MB.' });
    } else {
      const buffer = Buffer.from(await proposalFile.arrayBuffer());
      data.proposalUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: 'Dados inválidos.', fields: errors },
      { status: 400 },
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'Nenhum campo para atualizar.' },
      { status: 400 },
    );
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  });

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        ferramenta: project.ferramenta,
        progress: project.progress,
        team: project.team,
        price: Number(project.price),
        proposalUrl: project.proposalUrl,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const PATCH = withAuth<ProjectRouteParams>('album:manage', patchHandler);

// ─── DELETE ──────────────────────────────────────────────────────────

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: ProjectRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) return notFoundResponse();

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFoundResponse();

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth<ProjectRouteParams>('album:manage', deleteHandler);
