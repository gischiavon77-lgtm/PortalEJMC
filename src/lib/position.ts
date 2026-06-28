/**
 * Regras de cargo (position) por papel.
 *
 * Regra de negócio:
 *   - Usuários com papel MEMBRO têm o cargo fixo "Trainee" e NÃO podem
 *     alterá-lo.
 *   - Os demais papéis (Coordenador, Gerente, Diretor, Admin) podem
 *     editar o próprio cargo livremente.
 */

import type { UserRole } from '@prisma/client';

export const TRAINEE_LABEL = 'Trainee';

/** Cargo efetivo exibido: MEMBRO sempre vê "Trainee". */
export function effectivePosition(
  role: UserRole | null | undefined,
  position: string | null | undefined,
): string {
  if (role === 'MEMBRO') return TRAINEE_LABEL;
  return position?.trim() ? position.trim() : '';
}

/** Se o usuário pode editar o próprio cargo (todos menos MEMBRO). */
export function canEditOwnPosition(role: UserRole | null | undefined): boolean {
  return role !== 'MEMBRO';
}
