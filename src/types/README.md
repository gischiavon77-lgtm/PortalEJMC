# `src/types`

Tipos TypeScript compartilhados (não gerados pelo Prisma):

- `next-auth.d.ts` — extensão do tipo `Session` (incluir `role`, `area`).
- `api.ts` — tipos de request/response das API Routes.
- `permissions.ts` — `PermissionLevel`, `Action`, etc.

Os tipos de modelo (User, Goal, etc.) vêm de `@prisma/client` — não duplicar aqui.
