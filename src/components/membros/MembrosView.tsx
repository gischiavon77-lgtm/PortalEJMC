'use client';

/**
 * `MembrosView` — Alterna entre duas telas de membros:
 *
 *   1. "Álbum de Figurinhas" (`AlbumShell`) — preenchido manualmente,
 *      organizado por gestão e área.
 *   2. "Lista de Membros" (`SystemMembersView`) — puxa os usuários
 *      ativos do sistema, com a foto enviada pela própria pessoa,
 *      nome, cargo e filtro por área.
 */

import { useState } from 'react';

import { AlbumShell, type AlbumShellProps } from './AlbumShell';
import { SystemMembersView } from './SystemMembersView';

type Tab = 'album' | 'list';

export function MembrosView({ gestoes, initialGestao }: AlbumShellProps) {
  const [tab, setTab] = useState<Tab>('album');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Alternador de telas */}
      <div
        role="tablist"
        aria-label="Visualização de membros"
        className="inline-flex w-fit gap-1 rounded-lg bg-gray-100 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'album'}
          onClick={() => setTab('album')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'album'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          📸 Álbum de Figurinhas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'list'}
          onClick={() => setTab('list')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'list'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          📋 Lista de Membros
        </button>
      </div>

      {tab === 'album' ? (
        <AlbumShell gestoes={gestoes} initialGestao={initialGestao} />
      ) : (
        <SystemMembersView />
      )}
    </div>
  );
}
