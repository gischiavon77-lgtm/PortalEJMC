/**
 * Avatar de uma pessoa da equipe de projeto: foto ou iniciais.
 * Componente sem estado; serve a cards, detalhes e formulário de projetos
 * e aos cards do organograma da Estrutura (tamanho `lg`).
 */

import { cn } from '@/components/ui/cn';

export interface MemberAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-16 w-16 text-base',
} as const;

export function MemberAvatar({ name, avatarUrl, size = 'sm', className }: MemberAvatarProps) {
  const base = cn('shrink-0 rounded-full border-2 border-surface', SIZES[size], className);
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`Foto de ${name}`}
        title={name}
        className={cn(base, 'object-cover')}
      />
    );
  }
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        base,
        'flex items-center justify-center bg-surface-raised font-semibold text-text',
      )}
    >
      {getInitials(name)}
    </span>
  );
}
