'use client';

/**
 * `NotificationBell` — Sino de notificações funcional do portal.
 *
 * Comportamento:
 *   - Busca `/api/notifications` ao montar e a cada 60s (polling leve).
 *   - Mostra uma bolinha vermelha (badge) quando há comunicados/enquetes
 *     criados após o último momento em que o usuário abriu o sino.
 *   - Ao clicar, abre um popover listando os avisos ("Novo comunicado",
 *     "Nova enquete"). Clicar em um item navega para a página do módulo.
 *   - Abrir o popover marca tudo como "visto" (zera o badge), guardando
 *     o timestamp em `localStorage` (por dispositivo, sem migração de DB).
 *
 * O estado de leitura é por dispositivo/navegador — suficiente para o
 * portal interno e evita a necessidade de uma tabela de leitura no banco.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  type: 'announcement' | 'poll';
  title: string;
  createdAt: string; // ISO
  href: string;
}

const STORAGE_KEY = 'ejmc:notifications:lastSeen';
const STORAGE_KEY_CLEARED = 'ejmc:notifications:clearedAt';
const POLL_INTERVAL_MS = 60_000;

interface NotificationBellProps {
  /** Cor do ícone — 'light' para fundos claros (topbar), 'dark' para a sidebar escura. */
  tone?: 'light' | 'dark';
  className?: string;
}

export function NotificationBell({ tone = 'light', className }: NotificationBellProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  // Itens criados até este instante ficam ocultos ("limpos"). Itens
  // novos (criados depois) voltam a aparecer normalmente.
  const [clearedAt, setClearedAt] = useState<number>(0);
  // `markRef` guarda o lastSeen vigente no instante em que o popover
  // abriu, para que os itens continuem destacados como "novo" mesmo
  // após zerarmos o badge.
  const markRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carrega o marcador de leitura e de limpeza do localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const value = stored ? Number(stored) : 0;
    setLastSeen(Number.isNaN(value) ? 0 : value);
    markRef.current = Number.isNaN(value) ? 0 : value;

    const storedCleared = window.localStorage.getItem(STORAGE_KEY_CLEARED);
    const clearedValue = storedCleared ? Number(storedCleared) : 0;
    setClearedAt(Number.isNaN(clearedValue) ? 0 : clearedValue);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: NotificationItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      // Falha de rede: mantemos o estado anterior silenciosamente.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fecha o popover ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visibleItems = items.filter((it) => new Date(it.createdAt).getTime() > clearedAt);

  const unreadCount = visibleItems.filter(
    (it) => new Date(it.createdAt).getTime() > lastSeen,
  ).length;

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Ao abrir: congela o marcador atual para destacar os "novos"
        // e zera o badge persistindo o novo lastSeen.
        markRef.current = lastSeen;
        const now = Date.now();
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, String(now));
        }
        setLastSeen(now);
        // Atualiza a lista ao abrir para refletir o que há de mais recente.
        fetchNotifications();
      }
      return next;
    });
  }

  function handleItemClick(item: NotificationItem) {
    setOpen(false);
    router.push(item.href);
  }

  function handleClear() {
    const now = Date.now();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_CLEARED, String(now));
      window.localStorage.setItem(STORAGE_KEY, String(now));
    }
    setClearedAt(now);
    setLastSeen(now);
  }

  const iconColor =
    tone === 'dark'
      ? 'text-white/70 hover:text-white hover:bg-white/10'
      : 'text-text-muted hover:text-text-primary hover:bg-border-light';

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        aria-haspopup="true"
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/40 ${iconColor}`}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-vivid opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-vivid ring-2 ring-white" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Lista de notificações"
          className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border-light bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
            <p className="text-sm font-bold text-text-primary">Notificações</p>
            <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-text-muted">
              {visibleItems.length} {visibleItems.length === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>

          {visibleItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <>
              <ul className="max-h-[22rem] overflow-y-auto py-1">
                {visibleItems.map((item) => {
                  const isNew = new Date(item.createdAt).getTime() > markRef.current;
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleItemClick(item)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            item.type === 'poll'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-red-vivid/10 text-red-vivid'
                          }`}
                        >
                          {item.type === 'poll' ? (
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 11l3 3 8-8" />
                              <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 11v2a2 2 0 002 2h2l5 4V5L7 9H5a2 2 0 00-2 2z" />
                              <path d="M16 8a4 4 0 010 8" />
                            </svg>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[1px] text-text-muted">
                              {item.type === 'poll' ? 'Nova enquete' : 'Novo comunicado'}
                            </span>
                            {isNew && (
                              <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-red-vivid" />
                            )}
                          </span>
                          <span className="truncate text-sm font-medium text-text-primary">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {formatRelative(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: limpar notificações */}
              <div className="border-t border-border-light p-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[1px] text-text-muted transition-colors hover:bg-gray-50 hover:text-red-vivid focus-visible:bg-gray-50 focus-visible:outline-none"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                  Limpar notificações
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Formata a data de criação de forma relativa e curta em pt-BR
 * ("agora", "há 5 min", "há 2 h", "há 3 d") ou data absoluta para
 * itens mais antigos que uma semana.
 */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return '';

  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;

  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}
