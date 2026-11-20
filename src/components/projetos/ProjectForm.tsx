'use client';

/**
 * Formulário de projeto (Fase 3, "Radar"): criar e editar.
 *
 * Campos: banner (imagem opcional, com prévia), ferramenta, nome,
 * descrição, status, equipe (usuários ativos, escolhidos numa lista com
 * busca), preço e proposta em PDF. Só quem tem `project:write` chega a
 * este formulário; a API confere de novo.
 *
 * A equipe vem de `GET /api/users/members` (usuários ativos). Na edição,
 * preço e "há proposta" vêm dos detalhes (`ProjectDetail.management`).
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';

import { Button, Modal } from '@/components/ui';
import { getAreaTheme } from '@/lib/area-theme';
import type { ProjectDetail } from '@/lib/projects';
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  PROJECT_TOOLS,
  type ProjectStatusValue,
} from '@/lib/validators/project';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '@/lib/validators/upload';

import { MemberAvatar } from './MemberAvatar';

interface MemberOption {
  id: string;
  name: string;
  area: Parameters<typeof getAreaTheme>[0];
  avatarUrl: string | null;
}

export interface ProjectFormProps {
  open: boolean;
  /** `null` = criar; com valor = editar este projeto. */
  editProject: ProjectDetail | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const inputClass =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-faint focus-visible:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';
const labelClass = 'text-sm font-medium text-text';
const fileClass =
  'text-sm text-text-soft file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:bg-border';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ProjectForm({ open, editProject, onClose, onSaved }: ProjectFormProps) {
  const ids = {
    name: useId(),
    tool: useId(),
    description: useId(),
    status: useId(),
    banner: useId(),
    price: useId(),
    proposal: useId(),
    search: useId(),
  };
  const bannerInput = useRef<HTMLInputElement>(null);
  const proposalInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [ferramenta, setFerramenta] = useState<string>(PROJECT_TOOLS[0]);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatusValue>('EM_ANDAMENTO');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [proposal, setProposal] = useState<File | null>(null);

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersError, setMembersError] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preenche o formulário ao abrir (vazio para criar, dados atuais para editar).
  useEffect(() => {
    if (!open) return;
    setName(editProject?.name ?? '');
    setFerramenta(editProject?.ferramenta ?? PROJECT_TOOLS[0]);
    setDescription(editProject?.description ?? '');
    setStatus(editProject?.status ?? 'EM_ANDAMENTO');
    setMemberIds(editProject?.members.map((m) => m.id) ?? []);
    setPrice(editProject?.management ? String(editProject.management.price) : '');
    setBanner(null);
    setRemoveBanner(false);
    setProposal(null);
    setSearch('');
    setError(null);
    if (bannerInput.current) bannerInput.current.value = '';
    if (proposalInput.current) proposalInput.current.value = '';
  }, [open, editProject]);

  // Lista de usuários ativos para a equipe.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMembersError(false);
    fetch('/api/users/members', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { members: MemberOption[] };
        if (!cancelled) setMembers(data.members);
      })
      .catch(() => {
        if (!cancelled) setMembersError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!banner) {
      setBannerPreview(null);
      return;
    }
    const url = URL.createObjectURL(banner);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [banner]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return q ? members.filter((m) => normalize(m.name).includes(q)) : members;
  }, [members, search]);

  function toggleMember(id: string) {
    setMemberIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function pickFile(file: File | null, kind: 'banner' | 'proposal') {
    setError(null);
    if (file && file.size > UPLOAD_MAX_BYTES) {
      setError(`O arquivo deve ter no máximo ${UPLOAD_MAX_LABEL}.`);
      const input = kind === 'banner' ? bannerInput.current : proposalInput.current;
      if (input) input.value = '';
      return;
    }
    if (kind === 'banner') {
      setBanner(file);
      if (file) setRemoveBanner(false);
    } else {
      setProposal(file);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }

    const body = new FormData();
    body.append('name', name);
    body.append('ferramenta', ferramenta);
    body.append('description', description);
    body.append('status', status);
    body.append('memberIdsSent', '1');
    memberIds.forEach((id) => body.append('memberIds', id));
    body.append('price', price);
    if (banner) body.append('banner', banner);
    else if (removeBanner) body.append('removeBanner', '1');
    if (proposal) body.append('proposal', proposal);

    setSubmitting(true);
    setError(null);
    try {
      const url = editProject
        ? `/api/projects/${encodeURIComponent(editProject.id)}`
        : '/api/projects';
      const res = await fetch(url, { method: editProject ? 'PATCH' : 'POST', body });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        fields?: { message: string }[];
      } | null;
      if (!res.ok) {
        setError(
          data?.fields?.[0]?.message ?? data?.message ?? 'Não foi possível salvar o projeto.',
        );
        return;
      }
      onSaved(editProject ? 'Projeto atualizado!' : 'Projeto criado!');
    } catch {
      setError('Não foi possível salvar. Verifique a conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const currentBanner = !removeBanner && !bannerPreview ? editProject?.bannerUrl : null;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={editProject ? 'Editar projeto' : 'Novo projeto'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="project-form" loading={submitting}>
            {editProject ? 'Salvar' : 'Criar projeto'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Banner */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.banner} className={labelClass}>
            Banner (opcional)
          </label>
          {(bannerPreview || currentBanner) && (
            <div className="relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(bannerPreview ?? currentBanner) as string}
                alt="Prévia do banner"
                className="aspect-[16/9] w-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  if (bannerInput.current) bannerInput.current.value = '';
                  if (!bannerPreview) setRemoveBanner(true);
                }}
                className="absolute right-2 top-2 rounded-md bg-bg/80 px-2 py-1 text-xs font-medium text-text hover:bg-bg"
              >
                Remover
              </button>
            </div>
          )}
          <input
            ref={bannerInput}
            id={ids.banner}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null, 'banner')}
            className={fileClass}
          />
          <p className="text-xs text-text-faint">
            PNG, JPG ou WEBP, até {UPLOAD_MAX_LABEL}. Formato 16:9.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.tool} className={labelClass}>
              Ferramenta
            </label>
            <select
              id={ids.tool}
              value={ferramenta}
              onChange={(e) => setFerramenta(e.target.value)}
              className={inputClass}
            >
              {PROJECT_TOOLS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.status} className={labelClass}>
              Status
            </label>
            <select
              id={ids.status}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatusValue)}
              className={inputClass}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className={labelClass}>
            Nome
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={PROJECT_NAME_MAX}
            className={inputClass}
            data-testid="project-form-name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.description} className={labelClass}>
            Descrição
          </label>
          <textarea
            id={ids.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={PROJECT_DESCRIPTION_MAX}
            rows={4}
            className={`${inputClass} resize-y`}
          />
          <p className="text-right text-xs text-text-faint">
            {PROJECT_DESCRIPTION_MAX - description.length} caracteres restantes
          </p>
        </div>

        {/* Equipe */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>
            Equipe{' '}
            {memberIds.length > 0 && <span className="text-text-faint">({memberIds.length})</span>}
          </legend>
          <label htmlFor={ids.search} className="sr-only">
            Buscar pessoa
          </label>
          <input
            id={ids.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pessoa pelo nome"
            className={inputClass}
          />
          {membersError ? (
            <p className="text-sm text-danger">Não foi possível carregar os usuários.</p>
          ) : (
            <ul
              className="max-h-56 overflow-y-auto rounded-md border border-border"
              data-testid="project-form-members"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-sm text-text-faint">Nenhuma pessoa encontrada.</li>
              )}
              {filtered.map((m) => {
                const checked = memberIds.includes(m.id);
                return (
                  <li key={m.id} className="border-b border-border last:border-b-0">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(m.id)}
                        className="h-4 w-4 accent-brand"
                      />
                      <MemberAvatar
                        name={m.name}
                        avatarUrl={m.avatarUrl}
                        className="border-border"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text">{m.name}</span>
                        <span className="block truncate text-xs text-text-faint">
                          {getAreaTheme(m.area).label}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        {/* Gestão */}
        <div className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
          <p className="text-xs text-text-faint sm:col-span-2">
            Preço e proposta só aparecem para a gestão de projetos, nunca na listagem.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.price} className={labelClass}>
              Preço (R$)
            </label>
            <input
              id={ids.price}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.proposal} className={labelClass}>
              Proposta (PDF, até {UPLOAD_MAX_LABEL})
            </label>
            <input
              ref={proposalInput}
              id={ids.proposal}
              type="file"
              accept="application/pdf"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null, 'proposal')}
              className={fileClass}
            />
            {editProject?.management?.hasProposal && !proposal && (
              <p className="text-xs text-text-faint">
                Já existe uma proposta; envie outra para substituir.
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
