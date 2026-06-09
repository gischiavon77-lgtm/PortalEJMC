'use client';

/**
 * StickerCard — Figurinha individual de um membro do álbum.
 *
 * Card com foto (aspect ratio 5:7), nome e cargo, com efeito
 * de hover sutil e borda colorida da área.
 */

import { useState } from 'react';
import type { AlbumMember } from './AlbumShell';

interface StickerCardProps {
  member: AlbumMember;
  borderColor: string;
  canDelete: boolean;
  onDelete: () => void;
}

export function StickerCard({ member, borderColor, canDelete, onDelete }: StickerCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border-2 ${borderColor} bg-white shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-md`}
    >
      {/* Photo area (5:7 aspect ratio) */}
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-gray-100">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={`Foto de ${member.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-300"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        {/* Delete button overlay */}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className={`absolute right-1.5 top-1.5 rounded-full p-1.5 text-xs font-medium transition-all ${
              confirmDelete
                ? 'bg-red-600 text-white'
                : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
            }`}
            title={confirmDelete ? 'Clique novamente para confirmar' : 'Remover'}
          >
            {confirmDelete ? (
              <span className="px-1 text-[10px]">✓</span>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 text-center">
        <p className="truncate text-sm font-semibold text-text-primary">{member.name}</p>
        <p className="truncate text-xs text-text-secondary">{member.position}</p>
      </div>
    </div>
  );
}
