/**
 * Prisma Client singleton — Portal Interno EJMC
 *
 * Task 2.10: Cliente único do Prisma compartilhado por toda a aplicação.
 *
 * Por que um singleton?
 *   Em desenvolvimento, o hot reload do Next.js re-executa módulos a cada
 *   alteração. Sem cache, cada reload criaria uma nova `PrismaClient`,
 *   abrindo conexões adicionais até esgotar o pool do Postgres. A solução
 *   recomendada pela documentação oficial é guardar a instância em
 *   `globalThis` no ambiente de desenvolvimento. Em produção, o módulo é
 *   carregado uma única vez por processo, então basta criar a instância
 *   normalmente.
 *
 * Logs:
 *   - Em desenvolvimento, registramos `query`, `warn` e `error` para
 *     facilitar debug (por exemplo, identificar queries N+1).
 *   - Em produção, apenas `error` para reduzir ruído nos logs.
 *
 * Uso:
 *   import prisma from '@/lib/prisma';            // default export
 *   import { prisma } from '@/lib/prisma';        // named export equivalente
 *
 * Ambos apontam para a mesma instância.
 */

import { PrismaClient } from '@prisma/client';

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });

// Cache na global para sobreviver ao hot reload do Next.js em dev.
// Tipamos explicitamente para que o TypeScript reconheça `prisma` em globalThis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
