/**
 * Validação de arquivos enviados ao portal (avatares, fotos do álbum,
 * destaques e propostas em PDF).
 *
 * Regras:
 *   - O TIPO é decidido pelo CONTEÚDO do arquivo (assinatura nos
 *     primeiros bytes), nunca pelo `file.type` nem pela extensão, que
 *     vêm do navegador e podem ser forjados.
 *   - O TAMANHO é conferido no servidor contra um limite por categoria.
 *
 * Limite de 4 MB: na Vercel, o corpo de uma requisição a uma rota de API
 * não passa de ~4,5 MB. Como todo upload passa pelas rotas do portal
 * (a chave do Storage nunca vai ao navegador), 4 MB é o teto prático,
 * com folga para os demais campos do formulário.
 *
 * Módulo puro (sem I/O), compartilhável entre servidor e formulários, e
 * coberto por `tests/unit/validators-upload.test.ts`.
 */

export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const UPLOAD_MAX_LABEL = '4 MB';

/** Tipos aceitos, identificados pelo conteúdo. */
export type DetectedMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

export const IMAGE_MIMES: readonly DetectedMime[] = ['image/png', 'image/jpeg', 'image/webp'];
/** Avatar aceita só PNG e JPG (Req 17.5). */
export const AVATAR_MIMES: readonly DetectedMime[] = ['image/png', 'image/jpeg'];
export const PDF_MIMES: readonly DetectedMime[] = ['application/pdf'];

const EXTENSION_BY_MIME: Record<DetectedMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Identifica o tipo do arquivo pela assinatura (magic bytes).
 * Retorna `null` quando o conteúdo não é de nenhum tipo aceito.
 */
export function detectMime(bytes: Uint8Array): DetectedMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  // PDF: "%PDF-"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

export type UploadErrorCode = 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_FORMAT';

export type UploadValidation =
  | { ok: true; mime: DetectedMime; extension: string }
  | { ok: false; code: UploadErrorCode };

/**
 * Valida o conteúdo de um upload.
 *
 * @param bytes    conteúdo completo do arquivo
 * @param allowed  tipos aceitos para esta categoria
 * @param maxBytes limite de tamanho (padrão: 4 MB)
 */
export function validateUpload(
  bytes: Uint8Array,
  allowed: readonly DetectedMime[],
  maxBytes: number = UPLOAD_MAX_BYTES,
): UploadValidation {
  if (bytes.length === 0) return { ok: false, code: 'EMPTY_FILE' };
  if (bytes.length > maxBytes) return { ok: false, code: 'FILE_TOO_LARGE' };

  const mime = detectMime(bytes);
  if (!mime || !allowed.includes(mime)) return { ok: false, code: 'INVALID_FORMAT' };

  return { ok: true, mime, extension: EXTENSION_BY_MIME[mime] };
}
