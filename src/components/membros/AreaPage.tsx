'use client';

/**
 * AreaPage — Página colorida do álbum para uma área específica.
 *
 * Exibe o cabeçalho com gradiente, emoji decorativo e grid de
 * figurinhas dos membros daquela área na gestão selecionada.
 */

import type { Area } from '@prisma/client';

import { StickerCard } from './StickerCard';
import type { AlbumMember } from './AlbumShell';

interface AreaConfig {
  area: Area;
  label: string;
  emoji: string;
  gradient: string;
  border: string;
  bgLight: string;
}

interface AreaPageProps {
  config: AreaConfig;
  members: AlbumMember[];
  canManage: boolean;
  onAddClick: () => void;
  onDelete: (id: string) => void;
}

export function AreaPage({ config, members, canManage, onAddClick, onDelete }: AreaPageProps) {
  return (
    <div className={`overflow-hidden rounded-xl border ${config.border} ${config.bgLight}`}>
      {/* Colored header/banner */}
      <div className={`relative bg-gradient-to-r ${config.gradient} px-6 py-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{config.label}</h2>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex items-center gap-1.5 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
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
        {/* Decorative emoji */}
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-6xl opacity-20 sm:text-7xl">
          {config.emoji}
        </span>
      </div>

      {/* Members grid */}
      <div className="p-4 sm:p-6">
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white/50 p-8 text-center text-sm text-text-muted">
            Nenhum integrante adicionado em {config.label} nesta gestão.
            {canManage && ' Clique em "Adicionar Integrante" para começar.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((member) => (
              <StickerCard
                key={member.id}
                member={member}
                borderColor={config.border}
                canDelete={canManage}
                onDelete={() => onDelete(member.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
