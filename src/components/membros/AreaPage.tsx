'use client';

/**
 * AreaPage — Página colorida do álbum para uma área específica.
 *
 * Exibe o cabeçalho com gradiente, emoji decorativo e grid de
 * figurinhas dos membros daquela área na gestão selecionada.
 * Suporta drag-and-drop para reordenação quando `canManage` é true.
 */

import { useState, useCallback } from 'react';
import type { Area } from '@prisma/client';

import { StickerCard } from './StickerCard';
import type { AlbumMember } from './AlbumShell';

interface AreaConfig {
  area: Area;
  label: string;
  emoji: string;
  /** Classe de fundo na cor da área, usada num fio fino no topo do bloco. */
  accentBar: string;
}

interface AreaPageProps {
  config: AreaConfig;
  members: AlbumMember[];
  canManage: boolean;
  onAddClick: () => void;
  onDelete: (id: string) => void;
  onReorder?: (ids: string[]) => void;
}

export function AreaPage({
  config,
  members,
  canManage,
  onAddClick,
  onDelete,
  onReorder,
}: AreaPageProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      const fromIndex = dragIndex;
      setDragIndex(null);
      setDragOverIndex(null);

      if (fromIndex === null || fromIndex === dropIndex) return;

      // Reorder the array
      const reordered = [...members];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(dropIndex, 0, moved);

      const newIds = reordered.map((m) => m.id);
      onReorder?.(newIds);
    },
    [dragIndex, members, onReorder],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface hover-card">
      {/* Fio discreto na cor da área + cabeçalho neutro */}
      <div className={`h-0.5 ${config.accentBar}`} aria-hidden="true" />
      <div className="relative border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{config.label}</h2>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar Integrante
            </button>
          )}
        </div>
      </div>

      {/* Members grid */}
      <div className="p-4 sm:p-6">
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-white/50 p-8 text-center text-sm text-text-faint">
            Nenhum integrante adicionado em {config.label} nesta gestão.
            {canManage && ' Clique em "Adicionar Integrante" para começar.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((member, index) => (
              <StickerCard
                key={member.id}
                member={member}
                borderColor="border-border"
                canDelete={canManage}
                onDelete={() => onDelete(member.id)}
                draggable={canManage}
                isDragging={dragIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
