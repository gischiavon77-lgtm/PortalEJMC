'use client';

/**
 * `PostComposer` — formulário de nova publicação do feed (Fase 2).
 *
 * Texto obrigatório (até 2000 caracteres) e imagem opcional (PNG, JPG ou
 * WEBP, até 4 MB). O formulário confere o tamanho antes de enviar só para
 * avisar cedo; a validação que vale (tipo pelo conteúdo e tamanho) é a do
 * servidor.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Button, Modal } from '@/components/ui';
import type { PostItem } from '@/lib/posts';
import { POST_CONTENT_MAX_LENGTH } from '@/lib/validators/post';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '@/lib/validators/upload';

export interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: PostItem) => void;
}

const ACCEPT = 'image/png,image/jpeg,image/webp';

export function PostComposer({ open, onClose, onCreated }: PostComposerProps) {
  const textId = useId();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Libera a URL temporária da prévia quando a imagem muda ou o modal fecha.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function reset() {
    setContent('');
    setImage(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleFile(file: File | null) {
    setError(null);
    if (file && file.size > UPLOAD_MAX_BYTES) {
      setError(`A imagem deve ter no máximo ${UPLOAD_MAX_LABEL}.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setImage(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!content.trim()) {
      setError('Escreva o texto da publicação.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('content', content);
      if (image) body.append('image', image);

      const res = await fetch('/api/posts', { method: 'POST', body });
      const data = (await res.json().catch(() => null)) as
        | { post?: PostItem; message?: string; fields?: { message: string }[] }
        | null;

      if (!res.ok || !data?.post) {
        setError(
          data?.fields?.[0]?.message ?? data?.message ?? 'Não foi possível publicar. Tente novamente.',
        );
        return;
      }

      onCreated(data.post);
      reset();
      onClose();
    } catch {
      setError('Não foi possível publicar. Verifique a conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = POST_CONTENT_MAX_LENGTH - content.length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nova publicação"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="post-composer-form" loading={submitting}>
            Publicar
          </Button>
        </>
      }
    >
      <form id="post-composer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-sm font-medium text-text">
            Texto
          </label>
          <textarea
            id={textId}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={POST_CONTENT_MAX_LENGTH}
            rows={5}
            placeholder="O que você quer compartilhar com a EJMC?"
            className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            data-testid="post-composer-text"
          />
          <p className="text-right text-xs text-text-faint">{remaining} caracteres restantes</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="text-sm font-medium text-text">
            Imagem (opcional)
          </label>
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            accept={ACCEPT}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="text-sm text-text-soft file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:bg-border"
          />
          <p className="text-xs text-text-faint">PNG, JPG ou WEBP, até {UPLOAD_MAX_LABEL}.</p>
          {preview && (
            <div className="relative mt-1 overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Prévia da imagem" className="max-h-64 w-full object-contain" />
              <button
                type="button"
                onClick={() => handleFile(null)}
                className="absolute right-2 top-2 rounded-md bg-bg/80 px-2 py-1 text-xs font-medium text-text hover:bg-bg"
              >
                Remover
              </button>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
