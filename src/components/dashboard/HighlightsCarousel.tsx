'use client';

/**
 * HighlightsCarousel — 3 carrosséis de destaques do dashboard.
 *
 * 1. ✨ DESTAQUES — trainee, coordenador, assessor, gerente, equipe (left-to-right)
 * 2. 🏆 REFERÊNCIAS — ref-trainee, ref-coordenador, ref-assessor, ref-gerente, ref-equipe (right-to-left)
 * 3. 🎖️ PRÊMIO CULTURA — premio-movimento, premio-sangue, premio-uniao, premio-coracao, premio-voz (left-to-right)
 *
 * Admin/Diretor podem fazer upload/editar os destaques via modal inline.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '@/lib/validators/upload';

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
  aspectRatio: string;
  wide?: boolean;
}

interface CarouselConfig {
  title: string;
  slots: SlotConfig[];
  direction: 'forward' | 'reverse';
  labelColor: string;
  /** Sombra (glow) aplicada ao nome — mesma cor da categoria. */
  nameShadow: string;
}

// ─── Slot Definitions ────────────────────────────────────────────────

const DESTAQUES_SLOTS: SlotConfig[] = [
  { slot: 'trainee', label: 'Trainee Destaque', aspectRatio: 'aspect-[5/7]' },
  { slot: 'coordenador', label: 'Coordenador Destaque', aspectRatio: 'aspect-[5/7]' },
  { slot: 'assessor', label: 'Assessor Destaque', aspectRatio: 'aspect-[5/7]' },
  { slot: 'gerente', label: 'Gerente Destaque', aspectRatio: 'aspect-[5/7]' },
  {
    slot: 'equipe',
    label: 'Equipe Destaque',
    aspectRatio: 'aspect-[5/7] sm:aspect-auto sm:h-[360px]',
    wide: true,
  },
];

const REFERENCIAS_SLOTS: SlotConfig[] = [
  { slot: 'ref-trainee', label: 'Trainee Referência', aspectRatio: 'aspect-[5/7]' },
  { slot: 'ref-coordenador', label: 'Coordenador Referência', aspectRatio: 'aspect-[5/7]' },
  { slot: 'ref-assessor', label: 'Assessor Referência', aspectRatio: 'aspect-[5/7]' },
  { slot: 'ref-gerente', label: 'Gerente Referência', aspectRatio: 'aspect-[5/7]' },
  {
    slot: 'ref-equipe',
    label: 'Equipe Referência',
    aspectRatio: 'aspect-[5/7] sm:aspect-auto sm:h-[360px]',
    wide: true,
  },
];

const PREMIOS_SLOTS: SlotConfig[] = [
  { slot: 'premio-movimento', label: 'Prêmio Movimento', aspectRatio: 'aspect-[5/7]' },
  { slot: 'premio-sangue', label: 'Prêmio Sangue no Olho', aspectRatio: 'aspect-[5/7]' },
  { slot: 'premio-uniao', label: 'Prêmio União', aspectRatio: 'aspect-[5/7]' },
  { slot: 'premio-coracao', label: 'Prêmio Coração EJMC', aspectRatio: 'aspect-[5/7]' },
  { slot: 'premio-voz', label: 'Prêmio Voz do Cliente', aspectRatio: 'aspect-[5/7]' },
];

const ALL_SLOTS: SlotConfig[] = [...DESTAQUES_SLOTS, ...REFERENCIAS_SLOTS, ...PREMIOS_SLOTS];

const CAROUSELS: CarouselConfig[] = [
  {
    title: '✨ Destaques',
    slots: DESTAQUES_SLOTS,
    direction: 'forward',
    // Prateado
    labelColor: 'text-text-soft',
    nameShadow: '0 0 14px rgba(209,213,219,0.85)',
  },
  {
    title: '🏆 Referências',
    slots: REFERENCIAS_SLOTS,
    direction: 'reverse',
    // Dourado
    labelColor: 'text-warn',
    nameShadow: '0 0 14px rgba(251,191,36,0.85)',
  },
  {
    title: '🎖️ Prêmio Cultura',
    slots: PREMIOS_SLOTS,
    direction: 'forward',
    // Vermelho
    labelColor: 'text-danger',
    nameShadow: '0 0 14px rgba(232,32,58,0.85)',
  },
];

// ─── Main Component ──────────────────────────────────────────────────

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

  return (
    <div>
      {CAROUSELS.map((carousel) => (
        <CarouselSection
          key={carousel.title}
          config={carousel}
          loading={loading}
          canManage={canManage}
          onEdit={setEditingSlot}
          getHighlight={getHighlight}
        />
      ))}

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
    </div>
  );
}

// ─── Carousel Section ────────────────────────────────────────────────

function CarouselSection({
  config,
  loading,
  canManage,
  onEdit,
  getHighlight,
}: {
  config: CarouselConfig;
  loading: boolean;
  canManage: boolean;
  onEdit: (slot: string) => void;
  getHighlight: (slot: string) => Highlight | null;
}) {
  const animationClass =
    config.direction === 'forward' ? 'animate-marquee' : 'animate-marquee-reverse';

  return (
    <section className="w-full overflow-hidden py-8">
      {/* Title */}
      <h2 className="mb-8 text-center font-heading text-2xl font-bold tracking-wide text-white sm:text-3xl">
        {config.title}
      </h2>

      {/* Infinite marquee carousel */}
      <div className="relative mx-auto max-w-7xl overflow-hidden">
        <div className={`flex ${animationClass} gap-6 w-max`}>
          {/* First set */}
          {loading
            ? config.slots.map((s) => <SkeletonCard key={`a-${s.slot}`} config={s} />)
            : config.slots.map((s) => (
                <HighlightCard
                  key={`a-${s.slot}`}
                  config={s}
                  highlight={getHighlight(s.slot)}
                  canManage={canManage}
                  onEdit={() => onEdit(s.slot)}
                  labelColor={config.labelColor}
                  nameShadow={config.nameShadow}
                />
              ))}
          {/* Duplicated set for seamless loop */}
          {!loading &&
            config.slots.map((s) => (
              <HighlightCard
                key={`b-${s.slot}`}
                config={s}
                highlight={getHighlight(s.slot)}
                canManage={canManage}
                onEdit={() => onEdit(s.slot)}
                labelColor={config.labelColor}
                nameShadow={config.nameShadow}
              />
            ))}
        </div>
      </div>
    </section>
  );
}

// ─── Highlight Card ──────────────────────────────────────────────────

function HighlightCard({
  config,
  highlight,
  canManage,
  onEdit,
  labelColor,
  nameShadow,
}: {
  config: SlotConfig;
  highlight: Highlight | null;
  canManage: boolean;
  onEdit: () => void;
  labelColor: string;
  nameShadow: string;
}) {
  const hasPhoto = !!highlight?.photoUrl;

  return (
    <div
      className={`flex-shrink-0 snap-center ${config.wide ? 'w-80 sm:w-[400px]' : 'w-56 sm:w-64'}`}
    >
      <div className="relative flex flex-col items-center rounded-lg bg-surface border border-border p-4 transition hover:border-border">
        {/* Glow effect */}
        <div className="relative w-full">
          {/* Photo container */}
          <div
            className={`relative w-full ${config.aspectRatio} overflow-hidden rounded-xl bg-surface-raised`}
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
        <p
          className={`mt-3 text-center font-heading text-sm font-bold truncate w-full ${labelColor}`}
          style={{ textShadow: nameShadow }}
        >
          {highlight?.name ?? '—'}
        </p>

        {/* Category label */}
        <p className={`mt-1 text-center text-[10px] font-semibold ${labelColor}`}>{config.label}</p>

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
    <div
      className={`flex-shrink-0 snap-center ${config.wide ? 'w-80 sm:w-[400px]' : 'w-56 sm:w-64'}`}
    >
      <div className="flex flex-col items-center rounded-lg bg-surface border border-border p-4">
        <div
          className={`w-full ${config.aspectRatio} rounded-xl bg-surface-raised animate-pulse`}
        />
        <div className="mt-3 h-4 w-24 rounded bg-surface-raised animate-pulse" />
        <div className="mt-2 h-3 w-32 rounded bg-surface-raised animate-pulse" />
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

  const slotLabel = ALL_SLOTS.find((s) => s.slot === slot)?.label ?? slot;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    // Mesmo limite do servidor: avisa antes de tentar enviar.
    if (f && f.size > UPLOAD_MAX_BYTES) {
      setError(`A foto deve ter no máximo ${UPLOAD_MAX_LABEL}.`);
      e.target.value = '';
      return;
    }
    setError(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface border border-border p-6">
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
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/60"
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
            <p className="mt-1 text-[11px] text-white/40">
              PNG, JPG ou WEBP. Máximo {UPLOAD_MAX_LABEL}.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>

            {highlight && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-danger transition hover:bg-surface-raised disabled:opacity-50"
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
