/**
 * Testes de `src/lib/validators/upload.ts`.
 *
 * Cobrem a validação de arquivos no servidor: o tipo é decidido pelo
 * conteúdo (assinatura nos primeiros bytes), nunca pelo tipo declarado
 * pelo navegador, e o tamanho tem limite de 4 MB.
 */

import { describe, expect, it } from 'vitest';

import {
  AVATAR_MIMES,
  detectMime,
  IMAGE_MIMES,
  PDF_MIMES,
  UPLOAD_MAX_BYTES,
  validateUpload,
} from '@/lib/validators/upload';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];

/** Monta um arquivo com a assinatura dada e completa com zeros até `size`. */
function bytesOf(signature: number[], size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return bytes;
}

describe('detectMime', () => {
  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['WebP', WEBP, 'image/webp'],
    ['PDF', PDF, 'application/pdf'],
  ] as const)('reconhece %s pela assinatura', (_label, signature, expected) => {
    expect(detectMime(bytesOf([...signature]))).toBe(expected);
  });

  it('não reconhece conteúdo arbitrário', () => {
    expect(
      detectMime(new TextEncoder().encode('<html><script>alert(1)</script></html>')),
    ).toBeNull();
    expect(detectMime(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull(); // executável
    expect(detectMime(new Uint8Array(0))).toBeNull();
  });

  it('não confunde outro RIFF (ex.: WAV) com WebP', () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
    expect(detectMime(bytesOf(wav))).toBeNull();
  });

  it('não reconhece assinatura cortada', () => {
    expect(detectMime(new Uint8Array(PNG.slice(0, 4)))).toBeNull();
  });
});

describe('validateUpload', () => {
  it('aceita imagem válida e informa tipo e extensão', () => {
    expect(validateUpload(bytesOf(PNG), IMAGE_MIMES)).toEqual({
      ok: true,
      mime: 'image/png',
      extension: 'png',
    });
    expect(validateUpload(bytesOf(JPEG), IMAGE_MIMES)).toMatchObject({
      ok: true,
      extension: 'jpg',
    });
    expect(validateUpload(bytesOf(WEBP), IMAGE_MIMES)).toMatchObject({
      ok: true,
      extension: 'webp',
    });
  });

  it('aceita PDF válido na categoria de propostas', () => {
    expect(validateUpload(bytesOf(PDF), PDF_MIMES)).toEqual({
      ok: true,
      mime: 'application/pdf',
      extension: 'pdf',
    });
  });

  it('rejeita arquivo vazio', () => {
    expect(validateUpload(new Uint8Array(0), IMAGE_MIMES)).toEqual({
      ok: false,
      code: 'EMPTY_FILE',
    });
  });

  it('rejeita arquivo acima de 4 MB e aceita no limite exato', () => {
    expect(validateUpload(bytesOf(PNG, UPLOAD_MAX_BYTES + 1), IMAGE_MIMES)).toEqual({
      ok: false,
      code: 'FILE_TOO_LARGE',
    });
    expect(validateUpload(bytesOf(PNG, UPLOAD_MAX_BYTES), IMAGE_MIMES)).toMatchObject({ ok: true });
  });

  it('rejeita tipo válido que não pertence à categoria', () => {
    // PDF onde se espera imagem; imagem onde se espera PDF.
    expect(validateUpload(bytesOf(PDF), IMAGE_MIMES)).toEqual({
      ok: false,
      code: 'INVALID_FORMAT',
    });
    expect(validateUpload(bytesOf(PNG), PDF_MIMES)).toEqual({ ok: false, code: 'INVALID_FORMAT' });
  });

  it('avatar aceita PNG e JPG, mas não WebP', () => {
    expect(validateUpload(bytesOf(PNG), AVATAR_MIMES)).toMatchObject({ ok: true });
    expect(validateUpload(bytesOf(JPEG), AVATAR_MIMES)).toMatchObject({ ok: true });
    expect(validateUpload(bytesOf(WEBP), AVATAR_MIMES)).toEqual({
      ok: false,
      code: 'INVALID_FORMAT',
    });
  });

  it('rejeita conteúdo que não é de nenhum tipo aceito', () => {
    const html = new TextEncoder().encode('<html>não sou uma imagem</html>');
    expect(validateUpload(html, IMAGE_MIMES)).toEqual({ ok: false, code: 'INVALID_FORMAT' });
    expect(validateUpload(html, PDF_MIMES)).toEqual({ ok: false, code: 'INVALID_FORMAT' });
  });
});
