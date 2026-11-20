'use client';

/**
 * `HomeFeed` — feed central da página inicial (Fase 2 da reforma).
 *
 * Recebe a primeira página renderizada no servidor e busca as seguintes
 * em `GET /api/posts?cursor=...` ("Carregar mais"). Mais recentes primeiro.
 *
 * O botão de nova publicação só aparece para quem tem `post:create`
 * (Coordenador+); a API confere de novo. Nova publicação entra no topo
 * sem recarregar a página.
 */

import { useCallback, useState } from 'react';

import { Button, EmptyState, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import type { PostItem, PostPage } from '@/lib/posts';

import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';

export interface HomeFeedProps {
  initialPage: PostPage;
}

export function HomeFeed({ initialPage }: HomeFeedProps) {
  const { allowed: canPost } = usePermission('post:create');

  const [posts, setPosts] = useState<PostItem[]>(initialPage.posts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: 'success' | 'error';
    visible: boolean;
  }>({ message: '', variant: 'success', visible: false });

  const dismissToast = useCallback(() => setToast((t) => ({ ...t, visible: false })), []);
  const showError = useCallback(
    (message: string) => setToast({ message, variant: 'error', visible: true }),
    [],
  );

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts?cursor=${encodeURIComponent(nextCursor)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();
      const page = (await res.json()) as PostPage;
      // Evita duplicar caso uma publicação já esteja na lista.
      setPosts((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      showError('Não foi possível carregar mais publicações. Recarregue a página.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleCreated(post: PostItem) {
    setPosts((current) => [post, ...current]);
    setToast({ message: 'Publicação feita!', variant: 'success', visible: true });
  }

  function handleDeleted(postId: string) {
    setPosts((current) => current.filter((p) => p.id !== postId));
    setToast({ message: 'Publicação apagada.', variant: 'success', visible: true });
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Feed de publicações">
      {canPost && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="hover-card flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm text-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          data-testid="post-composer-open"
        >
          <span>Compartilhe algo com a EJMC…</span>
          <span className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            Nova publicação
          </span>
        </button>
      )}

      {posts.length === 0 ? (
        <EmptyState
          bordered
          message="Nenhuma publicação ainda."
          hint={canPost ? 'Que tal fazer a primeira?' : undefined}
        />
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} onDeleted={handleDeleted} onError={showError} />
        ))
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
            Carregar mais
          </Button>
        </div>
      )}

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={handleCreated}
      />

      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
    </section>
  );
}
