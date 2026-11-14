/**
 * Prisma 7 configuration — Portal Interno EJMC
 *
 * A partir do Prisma 7, a URL de conexão com o banco não pode mais ficar em
 * `prisma/schema.prisma`. Ela precisa ser configurada aqui via
 * `datasource.url`, lida da variável de ambiente DATABASE_URL.
 *
 * Carregamos `dotenv/config` para que as variáveis definidas em `.env.local`
 * (ou `.env`) fiquem disponíveis para a Prisma CLI quando rodarmos comandos
 * como `prisma migrate dev`, `prisma db seed` etc.
 *
 * Documentação:
 *   https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // A Prisma CLI (migrate deploy, migrate dev, db seed) usa esta URL.
    // Migrações precisam de conexão direta com o Postgres; com o pooler do
    // Supabase em modo transação (porta 6543, `?pgbouncer=true`) o
    // `migrate deploy` pode travar ou falhar. Se `DIRECT_URL` estiver
    // definida, ela tem prioridade; senão, vale `DATABASE_URL` como antes.
    // A aplicação em si (src/lib/prisma.ts) continua usando `DATABASE_URL`.
    url: process.env.DIRECT_URL || env('DATABASE_URL'),
  },
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
