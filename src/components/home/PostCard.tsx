'use client';

/**
 * `PostCard` — uma publicação do feed da página inicial (Fase 2).
 *
 * Autor (avatar, nome, cargo e área), data, texto, imagem opcional,
 * botão de curtir com contagem e, para quem pode, botão de apagar.
 *
 * Curtir é otimista: a contagem muda na hora e volta ao estado anterior
 * se a API falhar. A resposta da API é a fonte da verdade da contagem.
 */

import { useState } from 'react';

import { getAreaTheme } from '@/lib/area-theme';
import type { PostItem } from '@/lib/posts';

export interface PostCardProps {
  post: PostItem;
  onDeleted: (postId: string) => void;
  onError: (message: string) => void;
}

function formatPostDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export function PostCard({ post, onDeleted, onError }: PostCardProps) {
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liked, setLiked] = useState(post.likedByMe);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { author } = post;
  const subtitle = [author.position, getAreaTheme(author.area).label].filter(Boolean).join(' · ');

  async function toggleLike() {
    if (liking) return;
    const next = !liked;
    const previous = { liked, likeCount };
    setLiking(true);
    setLiked(next);
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { likeCount: number; likedByMe: boolean };
      setLiked(data.likedByMe);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(previous.liked);
      setLikeCount(previous.likeCount);
      onError('Não foi possível registrar a curtida. Tente novamente.');
    } finally {
      setLiking(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!confirm('Deseja realmente apagar esta publicação?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDeleted(post.id);
    } catch {
      setDeleting(false);
      onError('Não foi possível apagar a publicação.');
    }
  }

  return (
    <article
      className="hover-card overflow-hidden rounded-lg border border-border bg-surface"
      aria-label={`Publicação de ${author.name}`}
      data-testid="post-card"
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        {author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatarUrl}
            alt={`Foto de ${author.name}`}
            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-xs font-semibold text-text"
            aria-hidden="true"
          >
            {getInitials(author.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold text-text">{author.name}</p>
          <p className="truncate text-xs text-text-faint">{subtitle}</p>
        </div>
        <time dateTime={post.createdAt} className="shrink-0 text-xs text-text-faint">
          {formatPostDate(post.createdAt)}
        </time>
      </header>

      <p className="whitespace-pre-line break-words px-4 pb-3 text-sm leading-relaxed text-text">
        {post.content}
      </p>

      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt={`Imagem da publicação de ${author.name}`}
          loading="lazy"
          className="max-h-[32rem] w-full border-y border-border bg-bg object-contain"
        />
      )}

      <footer className="flex items-center justify-between gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          aria-pressed={liked}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
          className={[
            'flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
            liked ? 'text-text' : 'text-text-soft hover:text-text',
            'hover:bg-surface-raised disabled:cursor-wait',
          ].join(' ')}
        >
          <span className={liked ? 'text-brand' : undefined}>
            <HeartIcon filled={liked} />
          </span>
          <span className="text-text-soft" data-testid="post-like-count">
            {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
          </span>
        </button>

        {post.canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[44px] rounded-md px-3 text-xs font-medium text-text-faint transition-colors hover:bg-surface-raised hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-60"
          >
            {deleting ? 'Apagando…' : 'Apagar'}
          </button>
        )}
      </footer>
    </article>
  );
}
