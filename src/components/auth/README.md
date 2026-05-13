# `components/auth`

Componentes específicos do fluxo de autenticação:

- Formulários de login e cadastro.
- Botão “Entrar com Google”.
- Mensagens de status (conta pendente, bloqueada, aguardando aprovação).

Regra de negócio fica em `src/lib/auth.ts` e nas API Routes — aqui só UI + validação client-side com Zod.
