'use client';

/**
 * AlbumShell — Casca client-side do Álbum de Figurinhas.
 *
 * Gerencia o estado de gestão selecionada, faz fetch dos membros
 * via API, e renderiza as abas por área com as figurinhas.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Area } from '@prisma/client';

import { usePermission } from '@/hooks/usePermission';
import { AreaPage } from './AreaPage';
import { AddMemberModal } from './AddMemberModal';

export interface AlbumMember {
  id: string;
  name: string;
  position: string;
  area: Area;
  gestao: string;
  photoUrl: string | null;
}

interface AreaConfig {
  area: Area;
  label: string;
  emoji: string;
  /** Classe de fundo na cor da área, usada num fio fino no topo do bloco. */
  accentBar: string;
}

const AREAS: AreaConfig[] = [
  {
    area: 'VENDAS',
    label: 'Vendas',
    emoji: '🦈',
    accentBar: 'bg-area-vendas',
  },
  {
    area: 'PRESIDENCIA',
    label: 'Presidência',
    emoji: '🐘',
    accentBar: 'bg-area-presidencia',
  },
  {
    area: 'PROJETOS',
    label: 'Projetos',
    emoji: '🐙',
    accentBar: 'bg-area-projetos',
  },
  {
    area: 'MARKETING',
    label: 'Marketing',
    emoji: '🦅',
    accentBar: 'bg-area-marketing',
  },
  {
    area: 'GESTAO_PESSOAS',
    label: 'Gestão de Pessoas',
    emoji: '🐬',
    accentBar: 'bg-area-gp',
  },
  {
    area: 'ADM_FIN',
    label: 'Adm-Fin',
    emoji: '🦁',
    accentBar: 'bg-area-admfin',
  },
];

export interface AlbumShellProps {
  gestoes: string[];
  initialGestao: string | null;
}

export function AlbumShell({ gestoes, initialGestao }: AlbumShellProps) {
  const [selectedGestao, setSelectedGestao] = useState<string>(initialGestao ?? '');
  const [members, setMembers] = useState<Record<string, AlbumMember[]>>({});
  const [loading, setLoading] = useState(false);
  const [activeArea, setActiveArea] = useState<Area>('VENDAS');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGestaoInput, setNewGestaoInput] = useState('');
  const [allGestoes, setAllGestoes] = useState<string[]>(gestoes);

  const { allowed: canManage } = usePermission('album:manage');

  const fetchMembers = useCallback(async (gestao: string) => {
    if (!gestao) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/album?gestao=${encodeURIComponent(gestao)}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? {});
      }
    } catch (err) {
      console.error('[album] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGestao) {
      fetchMembers(selectedGestao);
    }
  }, [selectedGestao, fetchMembers]);

  function handleGestaoChange(value: string) {
    if (value === '__new__') {
      // Show inline input for new gestão
      return;
    }
    setSelectedGestao(value);
  }

  function handleAddNewGestao() {
    const trimmed = newGestaoInput.trim();
    if (/^\d{4}\.\d$/.test(trimmed)) {
      if (!allGestoes.includes(trimmed)) {
        setAllGestoes([trimmed, ...allGestoes]);
      }
      setSelectedGestao(trimmed);
      setNewGestaoInput('');
    }
  }

  function handleMemberAdded() {
    // Refetch after adding a member
    if (selectedGestao) {
      fetchMembers(selectedGestao);
    }
    // Also refresh gestões list
    fetch('/api/album/gestoes')
      .then((r) => r.json())
      .then((data) => {
        if (data.gestoes) setAllGestoes(data.gestoes);
      })
      .catch(() => {});
  }

  function handleDeleteMember(id: string) {
    fetch(`/api/album/${id}`, { method: 'DELETE' })
      .then((res) => {
        if (res.ok) {
          fetchMembers(selectedGestao);
        }
      })
      .catch(() => {});
  }

  function handleReorder(ids: string[]) {
    // Optimistic update: reorder local state immediately
    setMembers((prev) => {
      const areaMembers = prev[activeArea] ?? [];
      const reordered = ids
        .map((id) => areaMembers.find((m) => m.id === id))
        .filter(Boolean) as AlbumMember[];
      return { ...prev, [activeArea]: reordered };
    });

    // Persist to server
    fetch('/api/album/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {
      // Revert on failure
      fetchMembers(selectedGestao);
    });
  }

  const activeConfig = AREAS.find((a) => a.area === activeArea)!;
  const areaMembers = members[activeArea] ?? [];

  return (
    <section
      aria-labelledby="album-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1
            id="album-heading"
            className="font-heading text-3xl font-bold leading-tight text-text tablet:text-4xl"
          >
            Membros 📸
          </h1>
          <p className="mt-1 text-base font-semibold text-brand">
            Conheça os integrantes de cada gestão da EJMC.
          </p>
        </div>

        {/* Gestão selector */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="album-gestao-select" className="text-xs font-semibold text-text-faint">
              Gestão
            </label>
            <select
              id="album-gestao-select"
              value={selectedGestao}
              onChange={(e) => handleGestaoChange(e.target.value)}
              className="h-10 w-44 rounded-md border border-border bg-surface-raised px-3 text-sm text-text focus-visible:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {!selectedGestao && <option value="">Selecione...</option>}
              {allGestoes.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* New gestão input (admin only) */}
          {canManage && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="album-new-gestao" className="text-xs font-semibold text-text-faint">
                  Nova gestão
                </label>
                <input
                  id="album-new-gestao"
                  type="text"
                  placeholder="2026.1"
                  value={newGestaoInput}
                  onChange={(e) => setNewGestaoInput(e.target.value)}
                  className="h-10 w-28 rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-faint focus-visible:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                />
              </div>
              <button
                type="button"
                onClick={handleAddNewGestao}
                disabled={!/^\d{4}\.\d$/.test(newGestaoInput.trim())}
                className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* No gestão selected */}
      {!selectedGestao && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-text-faint">
          {allGestoes.length === 0
            ? 'Nenhuma gestão cadastrada ainda. Crie uma nova gestão para começar.'
            : 'Selecione uma gestão para ver o álbum.'}
        </p>
      )}

      {/* Album content */}
      {selectedGestao && (
        <>
          {/* Area tabs */}
          <nav
            className="flex gap-1 overflow-x-auto rounded-lg bg-surface-raised p-1"
            aria-label="Áreas"
          >
            {AREAS.map((areaConfig) => (
              <button
                key={areaConfig.area}
                type="button"
                onClick={() => setActiveArea(areaConfig.area)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeArea === areaConfig.area
                    ? 'bg-surface text-text shadow-sm'
                    : 'text-text-soft hover:text-text'
                }`}
              >
                <span>{areaConfig.emoji}</span>
                <span className="hidden sm:inline">{areaConfig.label}</span>
              </button>
            ))}
          </nav>

          {/* Area page */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
            </div>
          ) : (
            <AreaPage
              config={activeConfig}
              members={areaMembers}
              canManage={canManage}
              onAddClick={() => setShowAddModal(true)}
              onDelete={handleDeleteMember}
              onReorder={handleReorder}
            />
          )}
        </>
      )}

      {/* Add member modal */}
      {showAddModal && (
        <AddMemberModal
          gestao={selectedGestao}
          defaultArea={activeArea}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleMemberAdded}
        />
      )}
    </section>
  );
}
