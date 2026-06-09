'use client';

/**
 * AddMemberModal — Modal para adicionar um integrante ao álbum.
 *
 * Formulário com upload de foto, nome, cargo e área.
 * A gestão é preenchida automaticamente com a gestão selecionada.
 */

import { useState, useRef, type FormEvent } from 'react';
import type { Area } from '@prisma/client';

const AREAS: { value: Area; label: string }[] = [
  { value: 'VENDAS', label: 'Vendas' },
  { value: 'PRESIDENCIA', label: 'Presidência' },
  { value: 'PROJETOS', label: 'Projetos' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'GESTAO_PESSOAS', label: 'Gestão de Pessoas' },
  { value: 'ADM_FIN', label: 'Adm-Fin' },
];

interface AddMemberModalProps {
  gestao: string;
  defaultArea: Area;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddMemberModal({ gestao, defaultArea, onClose, onSuccess }: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [area, setArea] = useState<Area>(defaultArea);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const accepted = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!accepted.includes(file.type)) {
      setError('Tipo de imagem não suportado. Aceitos: PNG, JPG, WEBP.');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Foto deve ter no máximo 5MB.');
      return;
    }

    setPhotoFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    if (!position.trim()) {
      setError('Cargo é obrigatório.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('position', position.trim());
      formData.append('area', area);
      formData.append('gestao', gestao);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await fetch('/api/album', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? 'Erro ao adicionar integrante.');
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Adicionar Integrante</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative aspect-[5/7] w-32 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-red-core"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-xs">Foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <p className="text-xs text-text-muted">PNG, JPG ou WEBP. Máx 5MB.</p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="album-member-name" className="text-sm font-medium text-text-primary">
              Nome
            </label>
            <input
              id="album-member-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              maxLength={150}
              className="h-10 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
            />
          </div>

          {/* Position */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="album-member-position"
              className="text-sm font-medium text-text-primary"
            >
              Cargo
            </label>
            <input
              id="album-member-position"
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex: Diretor de Projetos"
              maxLength={100}
              className="h-10 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
            />
          </div>

          {/* Area */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="album-member-area" className="text-sm font-medium text-text-primary">
              Área
            </label>
            <select
              id="album-member-area"
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
              className="h-10 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
            >
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Gestão (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="album-member-gestao" className="text-sm font-medium text-text-primary">
              Gestão
            </label>
            <input
              id="album-member-gestao"
              type="text"
              value={gestao}
              readOnly
              className="h-10 rounded-md border border-border-light bg-gray-50 px-3 text-sm text-text-secondary"
            />
          </div>

          {/* Error */}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border-light px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-red-core px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
