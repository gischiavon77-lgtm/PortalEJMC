# `src/lib`

Utilitários de servidor e regra de negócio compartilhada:

- `prisma.ts` — singleton do Prisma Client.
- `auth.ts` — configuração do NextAuth.js v5 (Credentials + Google).
- `permissions.ts` — RBAC (`PermissionLevel`, `hasPermission`, matriz).
- `email.ts` — envio via Resend.
- `google-calendar.ts` — integração Google Calendar API v3.
- `validators/` — schemas Zod compartilhados entre UI e API.

Tudo aqui é executado no servidor (ou compartilhado isomórfico). Não importar em Client Components sem revisar.
