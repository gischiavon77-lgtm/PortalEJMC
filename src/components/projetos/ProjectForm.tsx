'use client';

/**
 * `ProjectForm` — Formulário de criação/edição de projeto.
 *
 * Modal com campos: Nome, Ferramenta (dropdown), Progresso (slider 0-100),
 * Equipe (texto, comma-separated), Preço (R$), Proposta Comercial (PDF upload).
 *
 * Envia como FormData (multipart) para suportar upload de arquivo.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button, Input, Modal } from '@/components/ui';

import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '@/lib/validators/upload';

import type { ProjectItem } from './ProjectsShell';

// ─── Ferramenta dropdown options (hardcoded from portfolio) ───

const FERRAMENTAS = [
  'Branding Innovation',
  'Marketing Estratégico',
  'Plano de Marketing Digital',
  'Apresentação Estratégica',
  'Pesquisa de Mercado',
  'Análise Concorrencial',
  'Análise Setorial',
  'Geomarketing',
  'Estudo de Mercado',
  'Mapeamento de Processos',
  'Mapeamento de Profissionais',
  'Plano de Salários',
  'Base de Dados',
  'Indicadores e BI',
  'Desenvolvimento Web',
  'Viabilidade de Negócios',
  'Plano de Negócios',
  'Estruturação Comercial e CRM',
  'Estruturação de Fluxo de Caixa e DRE',
  'Precificação',
  'Análise de Viabilidade Econômico-Financeira',
  'Reestruturação Financeira',
] as const;

// Mesmo limite aplicado no servidor (ver `@/lib/validators/upload`).
const MAX_PROPOSAL_SIZE = UPLOAD_MAX_BYTES;

type FormErrors = Partial<
  Record<'name' | 'ferramenta' | 'progress' | 'team' | 'price' | 'proposal' | '_global', string>
>;

export interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editProject?: ProjectItem | null;
}

export function ProjectForm({ open, onClose, onSaved, editProject }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [ferramenta, setFerramenta] = useState<string>(FERRAMENTAS[0]);
  const [progress, setProgress] = useState(0);
  const [team, setTeam] = useState('');
  const [price, setPrice] = useState('');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(editProject);

  useEffect(() => {
    if (!open) return;
    if (editProject) {
      setName(editProject.name);
      setFerramenta(editProject.ferramenta);
      setProgress(editProject.progress);
      setTeam(editProject.team);
      setPrice(editProject.price > 0 ? String(editProject.price) : '');
    } else {
      setName('');
      setFerramenta(FERRAMENTAS[0]);
      setProgress(0);
      setTeam('');
      setPrice('');
    }
    setProposalFile(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, editProject]);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    setErrors({});

    const trimmedName = name.trim();
    const trimmedTeam = team.trim();

    // Client-side validation
    const next: FormErrors = {};
    if (!trimmedName) {
      next.name = 'Nome é obrigatório.';
    } else if (trimmedName.length > 200) {
      next.name = 'Nome deve ter no máximo 200 caracteres.';
    }
    if (!ferramenta) {
      next.ferramenta = 'Ferramenta é obrigatória.';
    }
    if (progress < 0 || progress > 100) {
      next.progress = 'Progresso deve estar entre 0 e 100.';
    }
    const priceNum = price ? parseFloat(price) : 0;
    if (price && (isNaN(priceNum) || priceNum < 0)) {
      next.price = 'Preço deve ser um número positivo.';
    }
    if (proposalFile) {
      if (proposalFile.type !== 'application/pdf') {
        next.proposal = 'Apenas arquivos PDF são aceitos.';
      } else if (proposalFile.size > MAX_PROPOSAL_SIZE) {
        next.proposal = `O arquivo deve ter no máximo ${UPLOAD_MAX_LABEL}.`;
      }
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('ferramenta', ferramenta);
      formData.append('progress', String(progress));
      formData.append('team', trimmedTeam);
      formData.append('price', String(priceNum));
      if (proposalFile) {
        formData.append('proposal', proposalFile);
      }

      const url = isEditing ? `/api/projects/${editProject!.id}` : '/api/projects';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, body: formData });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string;
          message?: string;
          fields?: Array<{ path: string; message: string }>;
        } | null;

        if (data?.fields?.length) {
          const fieldErrors: FormErrors = {};
          for (const f of data.fields) {
            const key = (f.path as keyof FormErrors) ?? '_global';
            if (!fieldErrors[key]) fieldErrors[key] = f.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({
            _global: data?.message ?? 'Não foi possível salvar o projeto. Tente novamente.',
          });
        }
        return;
      }

      onSaved();
      onClose();
    } catch {
      setErrors({
        _global: 'Erro de conexão. Verifique sua internet e tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEditing ? 'Editar projeto' : 'Novo projeto'}
      description={
        isEditing ? 'Atualize os dados do projeto.' : 'Cadastre um novo projeto da empresa.'
      }
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="project-form" variant="primary" loading={submitting}>
            {isEditing ? 'Salvar' : 'Criar projeto'}
          </Button>
        </div>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {errors._global && (
          <div
            role="alert"
            className="rounded-md border border-brand bg-brand/20 px-3 py-2 text-sm text-danger"
          >
            {errors._global}
          </div>
        )}

        {/* Nome */}
        <Input
          label="Nome"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: undefined, _global: undefined }));
          }}
          maxLength={200}
          required
          placeholder="Ex.: Redesign do site corporativo"
          error={errors.name}
          disabled={submitting}
        />

        {/* Ferramenta (dropdown) */}
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="project-ferramenta" className="text-sm font-medium text-text">
            Ferramenta <span className="text-danger">*</span>
          </label>
          <select
            id="project-ferramenta"
            value={ferramenta}
            onChange={(e) => {
              setFerramenta(e.target.value);
              setErrors((prev) => ({ ...prev, ferramenta: undefined, _global: undefined }));
            }}
            disabled={submitting}
            className={[
              'h-10 w-full rounded-md border bg-surface px-3 text-sm text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              errors.ferramenta
                ? 'border-brand focus-visible:border-white/60'
                : 'border-border focus-visible:border-white/60',
              'disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-faint',
            ].join(' ')}
          >
            {FERRAMENTAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {errors.ferramenta && <p className="text-xs text-danger">{errors.ferramenta}</p>}
        </div>

        {/* Progresso (slider) */}
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="project-progress" className="text-sm font-medium text-text">
            Progresso: {progress}%
          </label>
          <input
            id="project-progress"
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => {
              setProgress(parseInt(e.target.value, 10));
              setErrors((prev) => ({ ...prev, progress: undefined, _global: undefined }));
            }}
            disabled={submitting}
            className="w-full accent-brand"
          />
          {errors.progress && <p className="text-xs text-danger">{errors.progress}</p>}
        </div>

        {/* Equipe */}
        <Input
          label="Equipe"
          name="team"
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setErrors((prev) => ({ ...prev, team: undefined, _global: undefined }));
          }}
          placeholder="Nomes separados por vírgula (ex.: João, Maria, Pedro)"
          error={errors.team}
          disabled={submitting}
        />

        {/* Preço */}
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="project-price" className="text-sm font-medium text-text">
            Preço (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
              R$
            </span>
            <input
              id="project-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setErrors((prev) => ({ ...prev, price: undefined, _global: undefined }));
              }}
              disabled={submitting}
              placeholder="0,00"
              className={[
                'h-10 w-full rounded-md border bg-surface pl-10 pr-3 text-sm text-text',
                'placeholder:text-text-faint',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                errors.price
                  ? 'border-brand focus-visible:border-white/60'
                  : 'border-border focus-visible:border-white/60',
                'disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-faint',
              ].join(' ')}
            />
          </div>
          {errors.price && <p className="text-xs text-danger">{errors.price}</p>}
        </div>

        {/* Proposta Comercial (PDF upload) */}
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="project-proposal" className="text-sm font-medium text-text">
            Proposta Comercial (PDF, máx. {UPLOAD_MAX_LABEL})
          </label>
          <input
            id="project-proposal"
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setProposalFile(file);
              setErrors((prev) => ({ ...prev, proposal: undefined, _global: undefined }));
            }}
            disabled={submitting}
            className="text-sm text-text-soft file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-border"
          />
          {isEditing && editProject?.hasProposal && !proposalFile && (
            <p className="text-xs text-text-faint">
              📄 Proposta existente. Selecione um novo arquivo para substituir.
            </p>
          )}
          {errors.proposal && <p className="text-xs text-danger">{errors.proposal}</p>}
        </div>
      </form>
    </Modal>
  );
}
