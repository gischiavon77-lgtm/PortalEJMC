/**
 * `GET /api/projects` e `POST /api/projects` — projetos (Fase 3, "Radar").
 *
 * GET — qualquer usuário logado. Devolve todos os projetos (ordem
 * alfabética) e os números do topo. A listagem NUNCA traz preço nem
 * informação de proposta, para ninguém; isso fica nos detalhes
 * (`GET /api/projects/:id`), só para quem tem `project:write`.
 *   200 { projects, stats }
 *
 * POST — `project:write` (Admin e Diretor). multipart/form-data:
 *   - name, ferramenta (obrigatórios), description, status
 *   - memberIds (vários campos de mesmo nome; usuários ativos)
 *   - banner (imagem opcional, até 4 MB, validada pelo conteúdo)
 *   - price e proposal (PDF opcional)
 *   201 { project } — no formato de detalhes
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { discardUploads, parseProjectForm } from '@/lib/project-form-handler';
import { getProjectDetail, listProjects } from '@/lib/projects';
import { prisma } from '@/lib/prisma';
import { createProjectSchema } from '@/lib/validators/project';

export const runtime = 'nodejs';

export const GET = withAuth(null, async () => {
  const { projects, stats } = await listProjects();
  return NextResponse.json({ projects, stats }, { status: 200 });
});

export const POST = withAuth('project:write', async (req: NextRequest, { session }) => {
  const result = await parseProjectForm(req, createProjectSchema, { canManage: true });
  if (!result.ok) return result.response;

  const { fields, bannerPath, proposalPath } = result.value;

  let id: string;
  try {
    const created = await prisma.project.create({
      data: {
        name: fields.name,
        ferramenta: fields.ferramenta,
        description: fields.description,
        status: fields.status,
        price: fields.price ?? 0,
        bannerPath,
        proposalPath,
        members: { create: fields.memberIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    id = created.id;
  } catch (err) {
    await discardUploads({ bannerPath, proposalPath });
    throw err;
  }

  const project = await getProjectDetail(id, session.user);
  return NextResponse.json({ project }, { status: 201 });
});
