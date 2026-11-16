/**
 * `PATCH /api/projects/:id` — Atualiza um projeto (Admin/Diretor).
 * `DELETE /api/projects/:id` — Remove um projeto (Admin/Diretor).
 *
 * Ambas exigem a permissão `project:write`.
 *
 * PATCH aceita multipart/form-data com campos opcionais:
 *   - name, ferramenta, progress, team, price, proposal
 *
 * A proposta (PDF, máx. 4 MB, validada pelo conteúdo) vai para o bucket
 * privado do Storage; o banco guarda só o caminho. Ao trocar a proposta
 * ou excluir o projeto, o arquivo anterior é removido do Storage.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { PROJECT_PUBLIC_SELECT, serializeProject } from '@/lib/projects';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { PDF_MIMES } from '@/lib/validators/upload';

export const runtime = 'nodejs';

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

  if (errors.length > 0) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: 'Dados inválidos.', fields: errors },
      { status: 400 },
    );
  }

  // Proposta: só envia ao Storage depois que os demais campos passaram
  // na validação, para não gravar arquivo de uma edição recusada.
  const proposalFile = formData.get('proposal');
  let newProposalPath: string | null = null;
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
    newProposalPath = stored.path;
    data.proposalPath = stored.path;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'Nenhum campo para atualizar.' },
      { status: 400 },
    );
  }

  let project;
  try {
    project = await prisma.project.update({
      where: { id },
      data,
      select: PROJECT_PUBLIC_SELECT,
    });
  } catch (err) {
    // O banco não aceitou: remove o PDF recém-enviado para não ficar órfão.
    await deleteFile('proposals', newProposalPath);
    throw err;
  }

  // Proposta substituída: remove o PDF anterior do Storage.
  if (newProposalPath) {
    await deleteFile('proposals', existing.proposalPath);
  }

  return NextResponse.json({ project: serializeProject(project) }, { status: 200 });
}

export const PATCH = withAuth<ProjectRouteParams>('project:write', patchHandler);

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
  // Projeto removido: apaga também o PDF da proposta no Storage.
  await deleteFile('proposals', existing.proposalPath);

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth<ProjectRouteParams>('project:write', deleteHandler);
