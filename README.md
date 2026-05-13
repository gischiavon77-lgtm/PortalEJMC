This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy `.env.local.example` to `.env.local` and fill in real values before running locally. Detalhes completos de setup em [`docs/SETUP.md`](./docs/SETUP.md).

### Banco de dados (Prisma 7)

A URL de conexão fica em `prisma.config.ts` (lendo `DATABASE_URL` de `.env.local`), conforme exigência do Prisma 7+. Após preencher `.env.local`, rode na raiz do projeto:

```bash
# 1) Gera e aplica a primeira migração (cria todas as tabelas)
npx prisma migrate dev --name init

# 2) Popula com dados iniciais (admin padrão, KPIs, infrações, 7 computadores)
npx prisma db seed
```

Comandos úteis:

```bash
npx prisma validate   # valida o schema sem tocar no banco
npx prisma format     # formata o schema
npx prisma generate   # (re)gera o Prisma Client
npx prisma studio     # GUI para inspecionar dados
```

> Pré‑visualização do SQL que a migração inicial geraria está versionada em
> [`prisma/migration_preview.sql`](./prisma/migration_preview.sql) para
> facilitar revisão antes de rodar `migrate dev` num banco real.

### Servidor de desenvolvimento

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
