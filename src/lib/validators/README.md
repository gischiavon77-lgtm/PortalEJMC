# `src/lib/validators`

Schemas Zod isomórficos, usados tanto em formulários (client) quanto em API Routes (server):

- `auth.ts` — login, registro, troca de senha.
- `goal.ts`, `kpi.ts`, `announcement.ts`, `poll.ts`, `infraction.ts`, `reservation.ts`, `service.ts`, `user.ts`.
- `common.ts` — helpers (CPF, telefone BR, email RFC 5322).

Manter os schemas aqui é o que garante que client e server compartilhem as MESMAS regras de validação.
