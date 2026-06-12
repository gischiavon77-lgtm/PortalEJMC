/**
 * `GET /api/projects` — Lista todos os projetos (ordenados por nome).
 * `POST /api/projects` — Cria um novo projeto (Admin/Diretor via album:manage).
 *
 * POST aceita multipart/form-data com campos:
 *   - name (string, required)
 *   - ferramenta (string, required)
 *   - progress (number, 0-100, default 0)
 *   - team (string, comma-separated names)
 *   - price (number)
 *   - proposal (file, PDF, optional, max 10MB)
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MAX_PROPOSAL_SIZE = 10 * 1024 * 1024; // 10MB

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      ferramenta: true,
      progress: true,
      team: true,
      price: true,
      proposalUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        ferramenta: p.ferramenta,
        progress: p.progress,
        team: p.team,
        price: Number(p.price),
        proposalUrl: p.proposalUrl,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    },
    { status: 200 },
  );
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
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

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const ferramenta = (formData.get('ferramenta') as string | null)?.trim() ?? '';
  const progressRaw = formData.get('progress') as string | null;
  const team = (formData.get('team') as string | null)?.trim() ?? '';
  const priceRaw = formData.get('price') as string | null;
  const proposalFile = formData.get('proposal') as File | null;

  // Validation
  const errors: Array<{ path: string; message: string }> = [];

  if (!name) {
    errors.push({ path: 'name', message: 'Nome é obrigatório.' });
  } else if (name.length > 200) {
    errors.push({ path: 'name', message: 'Nome deve ter no máximo 200 caracteres.' });
  }

  if (!ferramenta) {
    errors.push({ path: 'ferramenta', message: 'Ferramenta é obrigatória.' });
  } else if (ferramenta.length > 200) {
    errors.push({ path: 'ferramenta', message: 'Ferramenta deve ter no máximo 200 caracteres.' });
  }

  let progress = 0;
  if (progressRaw) {
    progress = parseInt(progressRaw, 10);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      errors.push({ path: 'progress', message: 'Progresso deve ser um número entre 0 e 100.' });
      progress = 0;
    }
  }

  let price = 0;
  if (priceRaw) {
    price = parseFloat(priceRaw);
    if (isNaN(price) || price < 0) {
      errors.push({ path: 'price', message: 'Preço deve ser um número positivo.' });
      price = 0;
    }
  }

  let proposalUrl: string | null = null;
  if (proposalFile && proposalFile.size > 0) {
    if (proposalFile.type !== 'application/pdf') {
      errors.push({ path: 'proposal', message: 'A proposta deve ser um arquivo PDF.' });
    } else if (proposalFile.size > MAX_PROPOSAL_SIZE) {
      errors.push({ path: 'proposal', message: 'O arquivo da proposta deve ter no máximo 10MB.' });
    } else {
      const buffer = Buffer.from(await proposalFile.arrayBuffer());
      proposalUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        fields: errors,
      },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({
    data: {
      name,
      ferramenta,
      progress,
      team,
      price,
      proposalUrl,
    },
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
    { status: 201 },
  );
}

export const POST = withAuth('album:manage', createHandler);
