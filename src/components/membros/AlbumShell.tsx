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
  gradient: string;
  border: string;
  bgLight: string;
}

const AREAS: AreaConfig[] = [
  {
    area: 'VENDAS',
    label: 'Vendas',
    emoji: '🦈',
    gradient: 'from-teal-400 to-teal-600',
    border: 'border-teal-300',
    bgLight: 'bg-teal-50',
  },
  {
    area: 'PRESIDENCIA',
    label: 'Presidência',
    emoji: '🐘',
    gradient: 'from-red-800 to-red-950',
    border: 'border-red-400',
    bgLight: 'bg-red-50',
  },
  {
    area: 'PROJETOS',
    label: 'Projetos',
    emoji: '🐙',
    gradient: 'from-orange-500 to-orange-700',
    border: 'border-orange-300',
    bgLight: 'bg-orange-50',
  },
  {
    area: 'MARKETING',
    label: 'Marketing',
    emoji: '🦅',
    gradient: 'from-purple-500 to-purple-700',
    border: 'border-purple-300',
    bgLight: 'bg-purple-50',
  },
  {
    area: 'GESTAO_PESSOAS',
    label: 'Gestão de Pessoas',
    emoji: '🐬',
    gradient: 'from-sky-400 to-sky-600',
    border: 'border-sky-300',
    bgLight: 'bg-sky-50',
  },
  {
    area: 'ADM_FIN',
    label: 'Adm-Fin',
    emoji: '🦁',
    gradient: 'from-yellow-500 to-amber-600',
    border: 'border-yellow-300',
    bgLight: 'bg-yellow-50',
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
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Álbum de Figurinhas
          </p>
          <h1
            id="album-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Membros 📸
          </h1>
          <p className="text-text-secondary">Conheça os integrantes de cada gestão da EJMC.</p>
        </div>

        {/* Gestão selector */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="album-gestao-select"
              className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
            >
              Gestão
            </label>
            <select
              id="album-gestao-select"
              value={selectedGestao}
              onChange={(e) => handleGestaoChange(e.target.value)}
              className="h-10 w-44 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
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
                <label
                  htmlFor="album-new-gestao"
                  className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
                >
                  Nova gestão
                </label>
                <input
                  id="album-new-gestao"
                  type="text"
                  placeholder="2026.1"
                  value={newGestaoInput}
                  onChange={(e) => setNewGestaoInput(e.target.value)}
                  className="h-10 w-28 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
                />
              </div>
              <button
                type="button"
                onClick={handleAddNewGestao}
                disabled={!/^\d{4}\.\d$/.test(newGestaoInput.trim())}
                className="h-10 rounded-md bg-red-core px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* No gestão selected */}
      {!selectedGestao && (
        <p className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted">
          {allGestoes.length === 0
            ? 'Nenhuma gestão cadastrada ainda. Crie uma nova gestão para começar.'
            : 'Selecione uma gestão para ver o álbum.'}
        </p>
      )}

      {/* Album content */}
      {selectedGestao && (
        <>
          {/* Area tabs */}
          <nav className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1" aria-label="Áreas">
            {AREAS.map((areaConfig) => (
              <button
                key={areaConfig.area}
                type="button"
                onClick={() => setActiveArea(areaConfig.area)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeArea === areaConfig.area
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
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
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-core" />
            </div>
          ) : (
            <AreaPage
              config={activeConfig}
              members={areaMembers}
              canManage={canManage}
              onAddClick={() => setShowAddModal(true)}
              onDelete={handleDeleteMember}
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
