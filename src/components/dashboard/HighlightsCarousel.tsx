'use client';

/**
 * HighlightsCarousel — Carrossel de destaques do dashboard.
 *
 * Exibe 5 cards de destaque (trainee, coordenador, assessor, gerente, equipe)
 * em um carrossel horizontal com efeito de glow/brilho por trás das fotos.
 * Admin/Diretor podem fazer upload/editar os destaques via modal inline.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePermission } from '@/hooks/usePermission';

// ─── Types ───────────────────────────────────────────────────────────

interface Highlight {
  id: string;
  slot: string;
  name: string;
  photoUrl: string | null;
  updatedAt: string;
  createdAt: string;
}

interface SlotConfig {
  slot: string;
  label: string;
  aspectRatio: string; // Tailwind aspect-ratio class
}

const SLOTS: SlotConfig[] = [
  { slot: 'trainee', label: 'TRAINEE DESTAQUE', aspectRatio: 'aspect-[5/7]' },
  { slot: 'coordenador', label: 'COORDENADOR DESTAQUE', aspectRatio: 'aspect-[5/7]' },
  { slot: 'assessor', label: 'ASSESSOR DESTAQUE', aspectRatio: 'aspect-[5/7]' },
  { slot: 'gerente', label: 'GERENTE DESTAQUE', aspectRatio: 'aspect-[5/7]' },
  {
    slot: 'equipe',
    label: 'EQUIPE DESTAQUE',
    aspectRatio: 'aspect-[5/7] sm:aspect-auto sm:h-[360px]',
  },
];

// ─── Component ───────────────────────────────────────────────────────

export function HighlightsCarousel() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);

  const { allowed: canManage } = usePermission('album:manage');

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await fetch('/api/highlights');
      if (res.ok) {
        const data = await res.json();
        setHighlights(data.highlights ?? []);
      }
    } catch {
      // fail silently — carousel shows empty placeholders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const getHighlight = (slot: string) => highlights.find((h) => h.slot === slot) ?? null;

  // Auto-scroll removido — usamos animação CSS marquee infinita

  return (
    <section className="w-full bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Title */}
      <h2 className="mb-8 text-center font-heading text-2xl font-bold tracking-wide text-white sm:text-3xl">
        ✨ DESTAQUES
      </h2>

      {/* Infinite marquee carousel */}
      <div className="relative mx-auto max-w-7xl overflow-hidden">
        <div className="flex animate-marquee gap-6 w-max">
          {/* First set */}
          {loading
            ? SLOTS.map((s) => <SkeletonCard key={`a-${s.slot}`} config={s} />)
            : SLOTS.map((s) => (
                <HighlightCard
                  key={`a-${s.slot}`}
                  config={s}
                  highlight={getHighlight(s.slot)}
                  canManage={canManage}
                  onEdit={() => setEditingSlot(s.slot)}
                />
              ))}
          {/* Duplicated set for seamless loop */}
          {!loading &&
            SLOTS.map((s) => (
              <HighlightCard
                key={`b-${s.slot}`}
                config={s}
                highlight={getHighlight(s.slot)}
                canManage={canManage}
                onEdit={() => setEditingSlot(s.slot)}
              />
            ))}
        </div>
      </div>

      {/* Upload/Edit Modal */}
      {editingSlot && (
        <UploadModal
          slot={editingSlot}
          highlight={getHighlight(editingSlot)}
          onClose={() => setEditingSlot(null)}
          onSave={() => {
            setEditingSlot(null);
            fetchHighlights();
          }}
        />
      )}
    </section>
  );
}

// ─── Highlight Card ──────────────────────────────────────────────────

function HighlightCard({
  config,
  highlight,
  canManage,
  onEdit,
}: {
  config: SlotConfig;
  highlight: Highlight | null;
  canManage: boolean;
  onEdit: () => void;
}) {
  const hasPhoto = !!highlight?.photoUrl;

  return (
    <div
      className={`flex-shrink-0 snap-center ${config.slot === 'equipe' ? 'w-80 sm:w-[400px]' : 'w-56 sm:w-64'}`}
    >
      <div className="relative flex flex-col items-center rounded-2xl bg-[#1a1a1a] border border-white/5 p-4 transition hover:border-white/10">
        {/* Glow effect */}
        <div className="relative w-full">
          {hasPhoto && (
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#c0182e] to-amber-500 opacity-40 blur-xl scale-90" />
          )}

          {/* Photo container */}
          <div
            className={`relative w-full ${config.aspectRatio} overflow-hidden rounded-xl bg-[#2a2a2a]`}
          >
            {hasPhoto ? (
              <img
                src={highlight!.photoUrl!}
                alt={highlight!.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <button
                onClick={canManage ? onEdit : undefined}
                disabled={!canManage}
                className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-white/20 rounded-xl transition hover:border-white/40 disabled:cursor-default disabled:hover:border-white/20"
                aria-label={`Adicionar foto para ${config.label}`}
              >
                <PlusIcon />
                {canManage && <span className="text-xs text-white/50">Adicionar</span>}
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <p className="mt-3 text-center font-heading text-sm font-bold text-white truncate w-full">
          {highlight?.name ?? '—'}
        </p>

        {/* Category label */}
        <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-amber-400">
          {config.label}
        </p>

        {/* Edit button for admins */}
        {canManage && hasPhoto && (
          <button
            onClick={onEdit}
            className="mt-2 rounded-md bg-white/10 px-3 py-1 text-[10px] font-medium text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            Editar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Card ───────────────────────────────────────────────────

function SkeletonCard({ config }: { config: SlotConfig }) {
  return (
    <div className="flex-shrink-0 snap-center w-56 sm:w-64">
      <div className="flex flex-col items-center rounded-2xl bg-[#1a1a1a] border border-white/5 p-4">
        <div className={`w-full ${config.aspectRatio} rounded-xl bg-[#2a2a2a] animate-pulse`} />
        <div className="mt-3 h-4 w-24 rounded bg-[#2a2a2a] animate-pulse" />
        <div className="mt-2 h-3 w-32 rounded bg-[#2a2a2a] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Upload Modal ────────────────────────────────────────────────────

function UploadModal({
  slot,
  highlight,
  onClose,
  onSave,
}: {
  slot: string;
  highlight: Highlight | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(highlight?.name ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(highlight?.photoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotLabel = SLOTS.find((s) => s.slot === slot)?.label ?? slot;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    if (!highlight && !file) {
      setError('Foto é obrigatória para novo destaque.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('slot', slot);
    formData.append('name', name.trim());
    if (file) {
      formData.append('photo', file);
    }

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Erro ao salvar.');
        return;
      }

      onSave();
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/highlights/${slot}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Erro ao remover.');
        return;
      }
      onSave();
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{slotLabel}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:text-white transition"
            aria-label="Fechar"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-4 flex justify-center">
            <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-contain" />
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="highlight-name"
              className="block text-sm font-medium text-white/70 mb-1"
            >
              Nome
            </label>
            <input
              id="highlight-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da pessoa ou equipe"
              maxLength={150}
              className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-amber-500/50"
            />
          </div>

          <div>
            <label
              htmlFor="highlight-photo"
              className="block text-sm font-medium text-white/70 mb-1"
            >
              Foto
            </label>
            <input
              id="highlight-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:bg-white/20"
            />
            <p className="mt-1 text-[11px] text-white/40">PNG, JPG ou WEBP. Máximo 5MB.</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#c0182e] to-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>

            {highlight && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/30"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
  );
}
