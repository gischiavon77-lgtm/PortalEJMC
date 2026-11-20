/**
 * Etapas comuns de criar e editar projeto (Fase 3) — SOMENTE SERVIDOR.
 *
 * Lê o multipart, valida os campos de texto (Zod), confere a equipe
 * (usuários ativos) e envia banner e proposta ao Storage, nesta ordem:
 * só manda arquivo ao Storage depois que todo o resto passou, para não
 * gravar arquivo de um cadastro que será recusado.
 *
 * Devolve os dados prontos para o Prisma, os caminhos dos arquivos novos
 * (para limpar se o banco falhar) ou uma `Response` de erro padronizada.
 */

import { NextResponse } from 'next/server';
import type { ZodError, ZodType } from 'zod';

import { findInvalidMemberIds } from '@/lib/projects';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { PROJECT_MESSAGES, readProjectForm } from '@/lib/validators/project';
import { IMAGE_MIMES, PDF_MIMES } from '@/lib/validators/upload';

export interface ParsedProjectForm<T> {
  fields: T;
  /** Caminho do banner novo no Storage, se enviado. */
  bannerPath: string | null;
  /** Caminho da proposta nova no Storage, se enviada. */
  proposalPath: string | null;
  /** O formulário pediu para tirar o banner atual (`removeBanner=1`). */
  removeBanner: boolean;
}

export type ProjectFormResult<T> =
  | { ok: true; value: ParsedProjectForm<T> }
  | { ok: false; response: Response };

function validationResponse(fields: { path: string; message: string }[]): Response {
  return NextResponse.json(
    { error: true, code: 'VALIDATION_ERROR', message: 'Dados inválidos.', fields },
    { status: 400 },
  );
}

function zodFields(err: ZodError) {
  return err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/** Remove arquivos enviados quando o banco não aceitou a gravação. */
export async function discardUploads(paths: {
  bannerPath: string | null;
  proposalPath: string | null;
}) {
  await deleteFile('images', paths.bannerPath);
  await deleteFile('proposals', paths.proposalPath);
}

export async function parseProjectForm<T extends { memberIds?: string[] }>(
  req: Request,
  schema: ZodType<T>,
  options: { canManage: boolean },
): Promise<ProjectFormResult<T>> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: true, code: 'INVALID_FORM', message: 'Envie os dados como multipart/form-data.' },
        { status: 400 },
      ),
    };
  }

  const raw = readProjectForm(form);
  // Preço só é aceito de quem tem gestão; para os demais é ignorado.
  if (!options.canManage) delete raw.price;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: validationResponse(zodFields(parsed.error)) };
  }

  const memberIds = parsed.data.memberIds ?? [];
  const invalid = await findInvalidMemberIds(memberIds);
  if (invalid.length > 0) {
    return {
      ok: false,
      response: validationResponse([
        { path: 'memberIds', message: PROJECT_MESSAGES.members.invalid },
      ]),
    };
  }

  const banner = form.get('banner');
  const proposal = options.canManage ? form.get('proposal') : null;

  let bannerPath: string | null = null;
  if (banner instanceof File && banner.size > 0) {
    const stored = await storeUpload(banner, {
      bucket: 'images',
      folder: 'projetos',
      allowed: IMAGE_MIMES,
      formatsLabel: 'PNG, JPG ou WEBP',
    });
    if (!stored.ok) return { ok: false, response: stored.response };
    bannerPath = stored.path;
  }

  let proposalPath: string | null = null;
  if (proposal instanceof File && proposal.size > 0) {
    const stored = await storeUpload(proposal, {
      bucket: 'proposals',
      folder: 'propostas',
      allowed: PDF_MIMES,
      formatsLabel: 'PDF',
    });
    if (!stored.ok) {
      await deleteFile('images', bannerPath);
      return { ok: false, response: stored.response };
    }
    proposalPath = stored.path;
  }

  const removeBanner = !bannerPath && form.get('removeBanner') === '1';
  return { ok: true, value: { fields: parsed.data, bannerPath, proposalPath, removeBanner } };
}
