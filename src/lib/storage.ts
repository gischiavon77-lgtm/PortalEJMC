/**
 * Acesso ao Supabase Storage — SOMENTE SERVIDOR.
 *
 * Este é o único módulo que conhece a chave do Storage
 * (`SUPABASE_SERVICE_ROLE_KEY`). Ele só pode ser importado por route
 * handlers e Server Components; nunca por Client Components. As
 * variáveis não têm prefixo `NEXT_PUBLIC_`, então o Next não as inclui
 * no bundle do navegador.
 *
 * Modelo de acesso:
 *   - Os dois buckets são PRIVADOS e não têm policies. Só a chave de
 *     serviço (que ignora RLS) consegue ler ou gravar.
 *   - O navegador nunca fala com o Storage. Uploads e downloads passam
 *     pelas rotas de API do portal, que conferem login e permissão e só
 *     então chamam as funções daqui.
 *   - O banco guarda apenas o CAMINHO do arquivo dentro do bucket.
 *
 * Buckets:
 *   - imagens   (`portal-imagens`):   avatars/, destaques/, posts/, projetos/
 *   - propostas (`portal-propostas`): propostas/
 *
 * Sem configuração (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` ausentes),
 * as funções lançam `StorageNotConfiguredError`; as rotas convertem em
 * 503 e o restante do portal continua funcionando.
 */

import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type StorageBucket = 'images' | 'proposals';

/** Pastas (prefixos) usadas dentro dos buckets. */
export type StorageFolder = 'avatars' | 'destaques' | 'posts' | 'projetos' | 'propostas';

const DEFAULT_BUCKET_NAMES: Record<StorageBucket, string> = {
  images: 'portal-imagens',
  proposals: 'portal-propostas',
};

export class StorageNotConfiguredError extends Error {
  readonly code = 'STORAGE_NOT_CONFIGURED' as const;
  constructor() {
    super('Armazenamento de arquivos não configurado.');
    this.name = 'StorageNotConfiguredError';
  }
}

export class StorageOperationError extends Error {
  readonly code = 'STORAGE_ERROR' as const;
  constructor(operation: string, detail: string) {
    super(`Falha no armazenamento (${operation}): ${detail}`);
    this.name = 'StorageOperationError';
  }
}

function bucketName(bucket: StorageBucket): string {
  const fromEnv =
    bucket === 'images'
      ? process.env.SUPABASE_BUCKET_IMAGES
      : process.env.SUPABASE_BUCKET_PROPOSALS;
  return fromEnv?.trim() || DEFAULT_BUCKET_NAMES[bucket];
}

/** `true` quando as duas variáveis obrigatórias estão definidas. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new StorageNotConfiguredError();
  }
  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      // Uso servidor-a-servidor: sem sessão de usuário, sem persistência.
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }
  return cachedClient;
}

/**
 * Gera um caminho novo e imprevisível para um arquivo: `<pasta>/<uuid>.<ext>`.
 * O nome original enviado pelo usuário nunca entra no caminho.
 */
export function newStoragePath(folder: StorageFolder, extension: string): string {
  return `${folder}/${randomUUID()}.${extension}`;
}

/** Envia um arquivo ao bucket. Lança em caso de falha. */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await getClient()
    .storage.from(bucketName(bucket))
    .upload(path, bytes, { contentType, upsert: false });

  if (error) {
    throw new StorageOperationError('upload', error.message);
  }
}

export interface StoredFile {
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * Baixa um arquivo do bucket. Retorna `null` quando o arquivo não existe
 * (ou não pôde ser lido), para a rota responder 404.
 */
export async function downloadFile(
  bucket: StorageBucket,
  path: string,
): Promise<StoredFile | null> {
  const { data, error } = await getClient().storage.from(bucketName(bucket)).download(path);

  if (error || !data) {
    console.error(`[storage] download falhou (${bucket}/${path}):`, error?.message);
    return null;
  }

  return {
    bytes: await data.arrayBuffer(),
    contentType: data.type || 'application/octet-stream',
  };
}

/**
 * Remove um arquivo do bucket. "Melhor esforço": nunca lança, porque é
 * chamada depois que o banco já foi atualizado (troca ou exclusão) e uma
 * falha aqui só deixaria um arquivo órfão, sem afetar o usuário.
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  try {
    const { error } = await getClient().storage.from(bucketName(bucket)).remove([path]);
    if (error) {
      console.error(`[storage] remoção falhou (${bucket}/${path}):`, error.message);
    }
  } catch (err) {
    console.error(`[storage] remoção falhou (${bucket}/${path}):`, err);
  }
}
