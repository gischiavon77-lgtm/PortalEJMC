/**
 * Etapa comum de upload das API Routes — SOMENTE SERVIDOR.
 *
 * `storeUpload` recebe o `File` do formulário e faz, nesta ordem:
 *   1. confere o tamanho declarado antes de ler o conteúdo (evita
 *      carregar na memória um arquivo que já se sabe grande demais);
 *   2. lê os bytes e valida tipo (pelo conteúdo) e tamanho real, via
 *      `validateUpload`;
 *   3. envia ao bucket com um caminho novo (`<pasta>/<uuid>.<ext>`).
 *
 * Devolve o caminho gravado ou uma `Response` de erro pronta, no formato
 * padrão da API (`{ error, code, message }`). Quem chama é responsável
 * por conferir login/permissão ANTES (via `withAuth`) e por gravar o
 * caminho no banco DEPOIS.
 *
 * Se a gravação no banco falhar depois do upload, chame
 * `deleteFile(bucket, path)` para não deixar arquivo órfão.
 */

import { NextResponse } from 'next/server';

import {
  newStoragePath,
  StorageNotConfiguredError,
  uploadFile,
  type StorageBucket,
  type StorageFolder,
} from '@/lib/storage';
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_LABEL,
  validateUpload,
  type DetectedMime,
} from '@/lib/validators/upload';

export interface StoreUploadOptions {
  bucket: StorageBucket;
  folder: StorageFolder;
  allowed: readonly DetectedMime[];
  /** Texto dos formatos aceitos para a mensagem de erro. Ex.: "PNG ou JPG". */
  formatsLabel: string;
}

export type StoreUploadResult = { ok: true; path: string } | { ok: false; response: Response };

function badRequest(code: string, message: string): Response {
  return NextResponse.json({ error: true, code, message }, { status: 400 });
}

/** 503 padronizado para quando o Storage não está configurado. */
export function storageNotConfiguredResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'STORAGE_NOT_CONFIGURED',
      message: 'O armazenamento de arquivos não está configurado. Avise o administrador.',
    },
    { status: 503 },
  );
}

/** 502 padronizado para falha do Storage (rede, bucket inexistente etc.). */
export function storageFailureResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'STORAGE_ERROR',
      message: 'Não foi possível salvar o arquivo agora. Tente novamente.',
    },
    { status: 502 },
  );
}

export async function storeUpload(
  file: File,
  options: StoreUploadOptions,
): Promise<StoreUploadResult> {
  const tooLarge = () =>
    badRequest('FILE_TOO_LARGE', `O arquivo deve ter no máximo ${UPLOAD_MAX_LABEL}.`);

  if (file.size > UPLOAD_MAX_BYTES) {
    return { ok: false, response: tooLarge() };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload(bytes, options.allowed);

  if (!validation.ok) {
    switch (validation.code) {
      case 'EMPTY_FILE':
        return { ok: false, response: badRequest('EMPTY_FILE', 'O arquivo enviado está vazio.') };
      case 'FILE_TOO_LARGE':
        return { ok: false, response: tooLarge() };
      case 'INVALID_FORMAT':
        return {
          ok: false,
          response: badRequest(
            'INVALID_FORMAT',
            `Formato não suportado. Use ${options.formatsLabel}.`,
          ),
        };
    }
  }

  const path = newStoragePath(options.folder, validation.extension);

  try {
    await uploadFile(options.bucket, path, bytes, validation.mime);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return { ok: false, response: storageNotConfiguredResponse() };
    }
    console.error('[upload] falha ao enviar ao Storage:', err);
    return { ok: false, response: storageFailureResponse() };
  }

  return { ok: true, path };
}
