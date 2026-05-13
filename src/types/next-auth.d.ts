/**
 * Augmentations dos tipos do NextAuth v5.
 *
 * Task 3.1: Estende `Session`, `User` e `JWT` com os campos de domínio
 * usados pelo Portal (`id`, `role`, `area`, `status`), garantindo
 * type-safety quando consumimos `auth()`, `useSession()` ou os callbacks
 * de `authConfig`.
 */

import type { AccountStatus, Area, UserRole } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      area: Area | null;
      status: AccountStatus;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: UserRole;
    area: Area | null;
    status: AccountStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    area: Area | null;
    status: AccountStatus;
    /**
     * Timestamp em milissegundos da última atividade autenticada do
     * usuário (último acesso a um endpoint que dispara o callback `jwt`).
     * Usado para impor a política de expiração por inatividade de 8h
     * (Task 3.4 / Req 1.1, 1.3). Atualizado pelo callback `jwt` em todas
     * as chamadas e comparado contra o limite de inatividade.
     */
    lastActivity: number;
  }
}
