/**
 * Resposta de download de arquivo do Storage — SOMENTE SERVIDOR.
 *
 * Usada pelas rotas de download (`/api/files/...` e
 * `/api/projects/:id/proposal`) DEPOIS que elas conferiram login e
 * permissão e descobriram o caminho do arquivo no banco. O caminho
 * nunca vem do cliente.
 *
 * O `Content-Type` é derivado da extensão do caminho, que foi definida
 * pelo servidor no upload a partir do conteúdo validado — não do
 * metadado guardado no Storage. `X-Content-Type-Options: nosniff`
 * impede o navegador de "adivinhar" outro tipo.
 */

import { NextResponse } from 'next/server';

import { downloadFile, StorageNotConfiguredError, type StorageBucket } from '@/lib/storage';
import { storageNotConfiguredResponse } from '@/lib/upload-handler';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export function fileNotFoundResponse(): Response {
  return NextResponse.json(
    { error: true, code: 'NOT_FOUND', message: 'Arquivo não encontrado.' },
    { status: 404 },
  );
}

export interface FileResponseOptions {
  /** Valor do cabeçalho `Cache-Control`. */
  cacheControl: string;
  /** Nome sugerido ao navegador (sem caminho). Opcional. */
  fileName?: string;
}

/**
 * Baixa o arquivo do bucket e devolve uma `Response` com o conteúdo.
 * 404 se o caminho é vazio ou o arquivo não existe; 503 se o Storage
 * não está configurado.
 */
export async function fileResponse(
  bucket: StorageBucket,
  path: string | null | undefined,
  options: FileResponseOptions,
): Promise<Response> {
  if (!path) {
    return fileNotFoundResponse();
  }

  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension];
  if (!contentType) {
    // Extensão que o portal nunca grava: trata como inexistente.
    return fileNotFoundResponse();
  }

  let file;
  try {
    file = await downloadFile(bucket, path);
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return storageNotConfiguredResponse();
    }
    throw err;
  }

  if (!file) {
    return fileNotFoundResponse();
  }

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Length': String(file.bytes.byteLength),
    'Cache-Control': options.cacheControl,
    'X-Content-Type-Options': 'nosniff',
  });
  if (options.fileName) {
    headers.set('Content-Disposition', `inline; filename="${options.fileName}"`);
  }

  return new Response(file.bytes, { status: 200, headers });
}
