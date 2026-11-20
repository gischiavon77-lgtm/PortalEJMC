/**
 * `/api/projects/:id` — detalhes, edição e exclusão (Fase 3, "Radar").
 *
 * GET — qualquer usuário logado. Formato de detalhes; `management`
 *   (preço e se há proposta) só vem para quem tem `project:write`.
 *   200 { project } · 404
 *
 * PATCH — `project:write`. multipart/form-data com os campos a alterar
 *   (name, ferramenta, description, status, memberIds, price, banner,
 *   proposal). Para salvar a equipe vazia, envie `memberIdsSent=1` sem
 *   nenhum `memberIds`. `removeBanner=1` tira o banner.
 *   Banner ou proposta substituídos são removidos do Storage.
 *   200 { project } · 400 · 404
 *
 * DELETE — `project:write`. Remove o projeto, a equipe (em cascata), o
 *   banner e a proposta no Storage.
 *   200 { success: true } · 404
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { withAuth } from '@/lib/api-auth';
import { discardUploads, parseProjectForm } from '@/lib/project-form-handler';
import { getProjectDetail } from '@/lib/projects';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { updateProjectSchema } from '@/lib/validators/project';

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

// ─── GET ─────────────────────────────────────────────────────────────

export const GET = withAuth<ProjectRouteParams>(
  null,
  async (_req: NextRequest, { session, params }) => {
    const id = params?.id;
    const project = id ? await getProjectDetail(id, session.user) : null;
    if (!project) return notFoundResponse();
    return NextResponse.json({ project }, { status: 200 });
  },
);

// ─── PATCH ───────────────────────────────────────────────────────────

export const PATCH = withAuth<ProjectRouteParams>(
  'project:write',
  async (req: NextRequest, { session, params }) => {
    const id = params?.id;
    const existing = id
      ? await prisma.project.findUnique({
          where: { id },
          select: { id: true, bannerPath: true, proposalPath: true },
        })
      : null;
    if (!existing) return notFoundResponse();

    const result = await parseProjectForm(req, updateProjectSchema, { canManage: true });
    if (!result.ok) return result.response;

    const { fields, bannerPath, proposalPath, removeBanner } = result.value;

    const data: Prisma.ProjectUpdateInput = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.ferramenta !== undefined) data.ferramenta = fields.ferramenta;
    if (fields.description !== undefined) data.description = fields.description;
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.price !== undefined) data.price = fields.price;
    if (bannerPath) data.bannerPath = bannerPath;
    else if (removeBanner) data.bannerPath = null;
    if (proposalPath) data.proposalPath = proposalPath;
    if (fields.memberIds !== undefined) {
      data.members = {
        deleteMany: {},
        create: fields.memberIds.map((userId) => ({ userId })),
      };
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: true, code: 'BAD_REQUEST', message: 'Nenhum campo para atualizar.' },
        { status: 400 },
      );
    }

    try {
      await prisma.project.update({ where: { id: existing.id }, data, select: { id: true } });
    } catch (err) {
      await discardUploads({ bannerPath, proposalPath });
      throw err;
    }

    // Arquivos substituídos (ou banner removido) saem do Storage.
    if (bannerPath || removeBanner) await deleteFile('images', existing.bannerPath);
    if (proposalPath) await deleteFile('proposals', existing.proposalPath);

    const project = await getProjectDetail(existing.id, session.user);
    return NextResponse.json({ project }, { status: 200 });
  },
);

// ─── DELETE ──────────────────────────────────────────────────────────

export const DELETE = withAuth<ProjectRouteParams>(
  'project:write',
  async (_req: NextRequest, { params }) => {
    const id = params?.id;
    const existing = id
      ? await prisma.project.findUnique({
          where: { id },
          select: { id: true, bannerPath: true, proposalPath: true },
        })
      : null;
    if (!existing) return notFoundResponse();

    await prisma.project.delete({ where: { id: existing.id } });
    await deleteFile('images', existing.bannerPath);
    await deleteFile('proposals', existing.proposalPath);

    return NextResponse.json({ success: true }, { status: 200 });
  },
);
