/**
 * Prisma Client singleton — Portal Interno EJMC
 *
 * Task 2.10: cliente único do Prisma compartilhado por toda a aplicação.
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
 * Driver adapter (Prisma 7):
 *   A partir do Prisma 7 a `PrismaClient` exige um driver adapter — não há
 *   mais o engine binário "library" como padrão. Usamos `@prisma/adapter-pg`
 *   sobre o driver `pg` para PostgreSQL/Supabase, lendo `DATABASE_URL` do
 *   ambiente (definida em `.env.local`).
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
import { PrismaPg } from '@prisma/adapter-pg';

const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;
  // Não lançamos exceção se faltar — em build estático do Next.js o módulo
  // pode ser carregado sem que conexões reais sejam executadas. Na primeira
  // query o adapter falhará com mensagem clara caso a URL não exista.
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'warn', 'error'],
  });
};

// Cache na global para sobreviver ao hot reload do Next.js em dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
