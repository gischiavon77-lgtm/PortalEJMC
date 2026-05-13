/**
 * Rate limiting de autenticação — Portal Interno EJMC
 *
 * Task 3.3: bloqueia o login de um email após 5 tentativas com falha
 * dentro de uma janela de 15 minutos, mantendo o bloqueio por mais 15
 * minutos. Implementa Property 2 (design.md) / Req 1.4.
 *
 * Modelo (no User):
 *   - `failedAttempts`         Int       — número de falhas na janela atual.
 *   - `firstFailedAttemptAt`   DateTime? — início da janela deslizante.
 *   - `lockedUntil`            DateTime? — instante em que o bloqueio expira.
 *
 * Algoritmo de janela deslizante:
 *   1. Se `lockedUntil` está no futuro → bloqueado.
 *   2. Em uma nova falha:
 *      a. Se já existe um `lockedUntil` no passado → bloqueio expirou,
 *         começamos uma janela nova com counter = 1.
 *      b. Se `firstFailedAttemptAt` é nulo OU foi há mais de 15 min →
 *         começamos uma janela nova com counter = 1.
 *      c. Caso contrário, counter += 1. Se counter atingir
 *         RATE_LIMIT_MAX_ATTEMPTS, definimos
 *         `lockedUntil = now + RATE_LIMIT_LOCKOUT_MS` e mantemos o
 *         counter em MAX (o reset acontece no próximo ciclo).
 *   3. Em login bem-sucedido, `resetFailedAttempts(userId)` zera tudo.
 *
 * Privacidade (Req 1.2 / Property 1):
 *   `registerFailedAttempt(email)` só atualiza usuários existentes.
 *   Para emails inexistentes a operação é um silent no-op — não criamos
 *   linhas nem expomos diferenças de timing observáveis pelo banco.
 *
 * Atomicidade:
 *   Cada operação é uma única chamada do Prisma (`update` / `updateMany`),
 *   garantindo atomicidade no banco. Pequenas corridas entre tentativas
 *   simultâneas (ex.: dois requests chegando ao mesmo tempo no quinto
 *   strike) são aceitáveis: no pior caso o usuário é bloqueado um pouco
 *   antes ou um pouco depois, ainda dentro do contrato da Property 2.
 */

import { prisma } from '@/lib/prisma';

/** Máximo de tentativas com falha permitidas dentro da janela. */
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Janela deslizante: 15 minutos em milissegundos. */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Duração do bloqueio após exceder o máximo: 15 minutos em milissegundos. */
export const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Verifica se o email está atualmente bloqueado por excesso de
 * tentativas. Para emails sem usuário associado retorna `blocked: false`
 * (não revelamos existência da conta).
 */
export async function checkLockedOut(
  email: string,
): Promise<{ blocked: boolean; lockedUntil?: Date }> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { blocked: false };

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { lockedUntil: true },
  });

  if (!user || !user.lockedUntil) return { blocked: false };

  const now = new Date();
  if (user.lockedUntil.getTime() > now.getTime()) {
    return { blocked: true, lockedUntil: user.lockedUntil };
  }
  return { blocked: false };
}

/**
 * Registra uma tentativa de login com falha para o email informado.
 *
 * - No-op para emails sem usuário associado (privacidade).
 * - Aplica a lógica de janela deslizante descrita no header.
 * - Quando atinge `RATE_LIMIT_MAX_ATTEMPTS`, define `lockedUntil` para
 *   `now + RATE_LIMIT_LOCKOUT_MS`.
 */
export async function registerFailedAttempt(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      failedAttempts: true,
      firstFailedAttemptAt: true,
      lockedUntil: true,
    },
  });

  if (!user) return; // não revelar existência da conta

  const now = new Date();

  // Determina se devemos iniciar uma nova janela ou incrementar a atual.
  const lockExpired =
    user.lockedUntil !== null && user.lockedUntil.getTime() <= now.getTime();
  const windowExpired =
    user.firstFailedAttemptAt === null ||
    now.getTime() - user.firstFailedAttemptAt.getTime() >= RATE_LIMIT_WINDOW_MS;

  let nextAttempts: number;
  let nextWindowStart: Date;
  let nextLockedUntil: Date | null;

  if (lockExpired || windowExpired) {
    // Janela nova — primeira falha do ciclo.
    nextAttempts = 1;
    nextWindowStart = now;
    nextLockedUntil = null;
  } else {
    nextAttempts = user.failedAttempts + 1;
    nextWindowStart = user.firstFailedAttemptAt ?? now;
    nextLockedUntil =
      nextAttempts >= RATE_LIMIT_MAX_ATTEMPTS
        ? new Date(now.getTime() + RATE_LIMIT_LOCKOUT_MS)
        : (user.lockedUntil ?? null);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: nextAttempts,
      firstFailedAttemptAt: nextWindowStart,
      lockedUntil: nextLockedUntil,
    },
  });
}

/**
 * Reseta o contador de tentativas e remove qualquer bloqueio ativo
 * para o usuário identificado por `userId`. Chamado após login OK.
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedAttempts: 0,
      firstFailedAttemptAt: null,
      lockedUntil: null,
    },
  });
}

function normalizeEmail(email: string): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
