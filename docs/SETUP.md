# Portal Interno EJMC — Setup local

Guia rápido para preparar o ambiente de desenvolvimento (Next.js 14 + Prisma 7 + PostgreSQL).

## 1. Pré‑requisitos

- Node.js 20+ (recomendado: 20 ou 22 LTS)
- npm 10+
- PostgreSQL 14+ rodando localmente (ou acesso a uma instância remota)

## 2. Instalar dependências

```bash
npm install
```

## 3. Variáveis de ambiente

Copie o exemplo e preencha com valores reais:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e ajuste pelo menos:

- `DATABASE_URL` — string de conexão PostgreSQL (`postgresql://user:pass@host:5432/portal_ejmc?schema=public`)
- `NEXTAUTH_SECRET` — gere com `openssl rand -base64 32`
- `NEXTAUTH_URL` — URL base local (`http://localhost:3000`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — credenciais OAuth do Google (opcional para login local com email/senha)
- `RESEND_API_KEY` — necessário para emails de aprovação/rejeição

> Obs.: a Prisma CLI carrega `.env.local` automaticamente porque
> `prisma.config.ts` faz `import 'dotenv/config'`.

## 4. Banco de dados — primeira migração

A configuração do banco fica em `prisma.config.ts` (Prisma 7+ não aceita
mais `url` no `schema.prisma`). Com `DATABASE_URL` já definida em
`.env.local`, execute na raiz do projeto:

```bash
# Cria o banco se não existir, gera a primeira migração e aplica
npx prisma migrate dev --name init

# Popula o banco com dados iniciais (admin padrão, KPIs, configuração de
# infrações, 7 computadores) — usa prisma/seed.ts
npx prisma db seed
```

Se algo der errado (por exemplo, banco já com tabelas), use:

```bash
npx prisma migrate reset   # APAGA tudo e re-aplica migrações + seed
```

## 5. Comandos úteis do Prisma

```bash
# Apenas validar o schema sem tocar no banco
npx prisma validate

# Formatar o schema in-place
npx prisma format

# (Re)gerar o client TypeScript a partir do schema
npx prisma generate

# Pré‑visualizar o SQL que seria gerado por uma migração a partir do zero
# (útil em revisão de código — não toca no banco)
npx prisma migrate diff --from-empty --to-schema=prisma/schema.prisma --script -o prisma/migration_preview.sql

# Abrir o GUI Prisma Studio
npx prisma studio
```

## 6. Rodar a aplicação

```bash
npm run dev      # http://localhost:3000
npm run test     # Vitest (unit + propriedade)
npm run test:e2e # Playwright
```

## 7. Troubleshooting

- **`Environment variable not found: DATABASE_URL`** → confira se `.env.local`
  está na raiz do projeto e se a variável está definida sem aspas extras.
- **`P3014` shadow database error** → o usuário do Postgres precisa de
  permissão `CREATEDB` para o Prisma criar o shadow database usado por
  `migrate dev`. Em Postgres locais, basta `ALTER USER seu_user CREATEDB;`.
- **`The datasource property url is no longer supported in schema files`** →
  significa que alguém adicionou `url = env(...)` de volta ao
  `schema.prisma`. Remova; a URL deve ficar apenas em `prisma.config.ts`.
