/**
 * Regras de cargo (position) por papel.
 *
 * Regra de negócio:
 *   - O papel MEMBRO cobre trainees e assessores (Fase 5 da reforma). O
 *     próprio membro escolhe o cargo numa lista fechada (`MEMBER_POSITIONS`),
 *     sem texto livre. Valor fora da lista (ou vazio) é exibido como
 *     "Trainee" — por exemplo, o cargo antigo de quem foi rebaixado.
 *   - Os demais papéis (Coordenador, Gerente, Diretor, Admin) editam o
 *     próprio cargo livremente.
 */

import type { UserRole } from '@prisma/client';

export const TRAINEE_LABEL = 'Trainee';
export const ASSESSOR_LABEL = 'Assessor(a)';

/** Cargos que um MEMBRO pode escolher. O primeiro é o padrão. */
export const MEMBER_POSITIONS = [TRAINEE_LABEL, ASSESSOR_LABEL] as const;
export type MemberPosition = (typeof MEMBER_POSITIONS)[number];

export function isMemberPosition(value: string | null | undefined): value is MemberPosition {
  return (MEMBER_POSITIONS as readonly string[]).includes(value?.trim() ?? '');
}

/** Cargo efetivo exibido: MEMBRO vê o cargo da lista fechada (padrão "Trainee"). */
export function effectivePosition(
  role: UserRole | null | undefined,
  position: string | null | undefined,
): string {
  if (role === 'MEMBRO') return isMemberPosition(position) ? position!.trim() : TRAINEE_LABEL;
  return position?.trim() ? position.trim() : '';
}

/** Se o usuário pode digitar o próprio cargo livremente (todos menos MEMBRO). */
export function canEditOwnPosition(role: UserRole | null | undefined): boolean {
  return role !== 'MEMBRO';
}

/**
 * Decide o que gravar quando o usuário pede para mudar o próprio cargo.
 *
 *   - `{ ok: true, value: undefined }` → não mexer no cargo.
 *   - `{ ok: true, value }`            → gravar `value`.
 *   - `{ ok: false }`                  → MEMBRO pediu cargo fora da lista.
 */
export function resolveOwnPositionUpdate(
  role: UserRole | null | undefined,
  requested: string | undefined,
): { ok: true; value: string | undefined } | { ok: false } {
  if (requested === undefined) return { ok: true, value: undefined };
  if (role !== 'MEMBRO') return { ok: true, value: requested };
  return isMemberPosition(requested) ? { ok: true, value: requested.trim() } : { ok: false };
}
