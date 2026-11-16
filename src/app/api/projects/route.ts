/**
 * `GET /api/projects` — Lista todos os projetos (ordenados por nome).
 *   Qualquer usuário autenticado. A listagem NÃO traz o PDF da proposta
 *   nem o caminho dele: só `hasProposal`. O download é feito em
 *   `GET /api/projects/:id/proposal`.
 * `POST /api/projects` — Cria um novo projeto (Admin/Diretor via project:write).
 *
 * POST aceita multipart/form-data com campos:
 *   - name (string, required)
 *   - ferramenta (string, required)
 *   - progress (number, 0-100, default 0)
 *   - team (string, comma-separated names)
 *   - price (number)
 *   - proposal (file, PDF, optional, max 4 MB) — validado pelo conteúdo
 *     e gravado no bucket privado de propostas do Storage.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { PROJECT_PUBLIC_SELECT, serializeProject } from '@/lib/projects';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { PDF_MIMES } from '@/lib/validators/upload';

export const runtime = 'nodejs';

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: PROJECT_PUBLIC_SELECT,
  });

  return NextResponse.json({ projects: projects.map(serializeProject) }, { status: 200 });
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

  // Só envia o PDF ao Storage depois que os demais campos passaram na
  // validação, para não gravar arquivo de um cadastro que será recusado.
  let proposalPath: string | null = null;
  if (proposalFile instanceof File && proposalFile.size > 0) {
    const stored = await storeUpload(proposalFile, {
      bucket: 'proposals',
      folder: 'propostas',
      allowed: PDF_MIMES,
      formatsLabel: 'PDF',
    });
    if (!stored.ok) {
      return stored.response;
    }
    proposalPath = stored.path;
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        ferramenta,
        progress,
        team,
        price,
        proposalPath,
      },
      select: PROJECT_PUBLIC_SELECT,
    });

    return NextResponse.json({ project: serializeProject(project) }, { status: 201 });
  } catch (err) {
    // O banco não aceitou: remove o PDF recém-enviado para não ficar órfão.
    await deleteFile('proposals', proposalPath);
    throw err;
  }
}

export const POST = withAuth('project:write', createHandler);
