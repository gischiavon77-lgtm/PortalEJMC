# CLAUDE.md — Portal Interno EJMC

Portal web interno da empresa júnior EJMC (até ~80 usuários): dashboard, cronograma, metas, KPIs, membros/álbum, perfil, portfólio, projetos, comunicados, enquetes, pontuação (infrações), reserva de computadores, configurações e admin. Interface, mensagens, comentários e commits em **pt-BR**.

## Regras de trabalho

- Sempre explicar as mudanças em português.
- Nunca alterar o arquivo `.env`.

## Situação do deploy (atualizado em 2026-11-15)

Não existe produção hoje. O projeto antigo na Vercel foi apagado e o banco antigo expirou. O deploy será feito do zero, com um banco novo.

- Num banco novo e vazio, o `prisma migrate deploy` do build aplica as 5 migrações de `prisma/migrations/` desde o início. Não é preciso baseline.
- Depois das migrações, rode `npx prisma db seed` com `SEED_ADMIN_PASSWORD` definida para criar os dados iniciais (admin `admin@ejmc.com`).
- Não há dados antigos a preservar nem a migrar.
- O passo a passo está em `docs/DEPLOY.md`.

## Pendências prioritárias

Nesta ordem:

1. Atualizar o Next.js e tratar o `npm audit`.
2. ~~Trocar o build `prisma db push --accept-data-loss` por `prisma migrate deploy` e gerar a migração que falta.~~ **Concluída** (commit `7d065a8`): o build usa `prisma migrate deploy` e a migração `20260612000000_redesign_project` cobre o redesenho de `Project`. Como o deploy será do zero, não resta baseline a fazer.
3. ~~Mover PDFs e fotos em base64 do banco para o Supabase Storage.~~ **Concluída no código** (ver "Arquivos (Supabase Storage)"). Falta criar os dois buckets privados e definir `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no ambiente; ainda não foi testado contra um Supabase real.
4. ~~Reconsultar cargo e status no banco a cada requisição, em vez de confiar no JWT.~~ **Concluída**: o callback `jwt` confere o usuário no banco a cada leitura de sessão (`src/lib/session-refresh.ts`).
5. ~~Remover a senha padrão do admin do seed e alinhar o `docs/DEPLOY.md`.~~ **Concluída**: o seed exige `SEED_ADMIN_PASSWORD` e falha sem ela.
6. Ajustar o SSL em `src/lib/prisma.ts`.
7. Cadastro por código de ativação.
8. LGPD: política de privacidade, revisão do CPF e RLS no Supabase.
9. Atualizar o `docs/SETUP.md`.

## Funcionalidades planejadas

Ainda não implementadas:

O escopo detalhado está em `docs/ROADMAP-REDESIGN.md`; em caso de conflito com a lista abaixo, vale o roteiro.

1. ~~Sidebar fixa.~~ **Concluída** na Fase 1 da reforma visual.
2. ~~Página inicial em feed.~~ **Concluída** na Fase 2 da reforma.
3. Projetos com imagem, descrição, status, contadores e equipe ligada a usuários.
4. Categorias nos eventos do calendário.
5. Organograma por área gerado a partir dos usuários, com data de entrada. O álbum continua como histórico por gestão.

## Identidade visual (reforma em fases)

Reforma visual e funcional em fases, na branch `redesign`. Um commit por fase; antes de cada fase, apresentar o plano e aguardar aprovação. **Fase 1 (base visual) concluída.**

**Roteiro das fases e o que falta:** [`docs/ROADMAP-REDESIGN.md`](docs/ROADMAP-REDESIGN.md). Leia esse arquivo no início de cada sessão.

Regras da marca, válidas para qualquer tela nova:

- **Tema escuro único.** Fundo chapado quase preto. Sem degradês, sem efeito de vidro, sem sombras fortes. Não existe alternância de tema.
- **League Spartan** (`font-heading`): títulos de página, títulos de cards, números de destaque e nome da marca. Sempre branca, em negrito e maior. `h1`–`h4` já recebem a fonte por regra global.
- **Montserrat** (`font-body`): todo o restante. Menor e **nunca em maiúsculas** (não usar `uppercase`; escrever em caixa normal).
- **`brand` (#87000a) é a única cor de destaque**: botão principal (texto branco), item ativo do menu, "hoje" no calendário e subtítulo de página.
- **Contraste**: `brand` sobre o fundo escuro tem ~1,9:1. Texto corrido, de tabela, rótulos e textos pequenos usam `text`/`text-soft`, nunca `brand`. Texto de erro usa `danger`. Foco de teclado usa anel branco translúcido (`ring-white/30`).
- **Cabeçalho de página**: título em League Spartan e, logo abaixo, subtítulo em Montserrat (16px, peso 600) na cor `brand`. Usar o componente `PageHeader`.
- Etiquetas de status e categoria usam as cores auxiliares discretas (`ok`, `warn`, `info`, `danger`), sem competir com o vermelho.

Tokens (definidos em `tailwind.config.ts`, espelhados como CSS variables em `src/app/globals.css`):

| Grupo       | Tokens                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Superfícies | `bg` #0a0a0b · `surface` #141416 · `surface-raised` #1c1c1f · `surface-hover` #0c0c0e · `border` #26262a               |
| Texto       | `text` #ffffff · `text-soft` #a1a1aa · `text-faint` #71717a                                                            |
| Marca       | `brand` #87000a · `brand-hover` #a1000c                                                                                |
| Auxiliares  | `danger` #e0545c · `ok` #5fb38a · `warn` #c9a24a · `info` #6f9bd1                                                      |
| Áreas       | `area-vendas` · `area-presidencia` · `area-projetos` · `area-marketing` · `area-gp` · `area-admfin` (só em fios finos) |
| Fontes      | `font-heading` (League Spartan) · `font-body` (Montserrat), via `next/font/google` em `src/app/layout.tsx`             |
| Cantos      | `rounded-sm` 6px · `rounded-md` 8px (controles) · `rounded-lg` 10px (cards) · `rounded-xl` 12px                        |
| Layout      | `w-sidebar`/`pl-sidebar` 16rem · `h-topbar`/`pt-topbar` 3.5rem                                                         |

Componentes reutilizáveis em `@/components/ui`: `PageHeader`, `StatCard` (número grande + rótulo), `StatusBadge`, `EmptyState`, além de `Button` (`primary` em `brand`), `Card`, `Input`, `Modal`, `DataTable`, `Badge`, `Pagination`, `Toast`.

Layout: `Sidebar` fixa à esquerda na altura toda (logo, etiqueta do cargo e sino de notificações no topo; itens em grupos com divisórias definidos por `group` em `sidebar-items.ts`; avatar/nome/área/sair no rodapé). A partir de 768px não há barra superior. Abaixo disso a sidebar vira menu recolhível, aberto pelo botão da barra superior, que só existe no celular (`PortalShell`) e traz também o sino.

Destaque ao passar o mouse: cards e caixas de conteúdo recebem a classe `hover-card` (`globals.css`), que escurece o fundo para `surface-hover` e deixa a borda em `brand`. `Card` e `StatCard` já a aplicam. Linhas de tabela e dias do calendário usam `hover:bg-surface-hover`. Não usar em modais, menus suspensos nem no contêiner de tabelas.

**Cache após mudar o tema:** depois de alterar `tailwind.config.ts` ou `globals.css`, reinicie o `npm run dev` apagando a pasta `.next`. Com o cache antigo, o servidor serve o CSS anterior e as páginas aparecem sem cores e com fonte serifada.

Telas públicas (login, cadastro, 403) usam as classes `auth-card`, `auth-input`, `auth-button` de `globals.css`.

## Stack

- **Next.js 14.2 (App Router)** + React 18 + TypeScript (`strict`), alias `@/*` → `src/*`
- **Prisma 7** + PostgreSQL (Supabase) via driver adapter `@prisma/adapter-pg`
- **NextAuth v5 (beta)** — Credentials + Google, sessão JWT
- **Zod 4** para validação, **Tailwind 3** para estilo
- **Resend** (emails), **googleapis** (Google Calendar via Service Account)
- **Supabase Storage** via `@supabase/supabase-js` (só no servidor; exige Node 22+)
- Testes: **Vitest** (jsdom) + Testing Library + **fast-check**; **Playwright** para E2E
- Deploy: **Vercel** (ainda sem projeto criado; ver "Situação do deploy"). Depois de configurado, push em `main` publica e branches geram preview.

## Comandos

```bash
npm run dev            # servidor local em http://localhost:3000
npm run lint           # next lint
npm run format         # prettier --write
npm run format:check
npm test               # vitest run (tests/unit + tests/property + src/**/*.test.*)
npm run test:watch
npx vitest run tests/unit/permissions.test.ts   # um arquivo só
npm run test:e2e       # playwright (sobe `npm run dev` sozinho; precisa de banco com seed)
npm run test:e2e:install                        # baixa os browsers do Playwright

npx prisma validate
npx prisma generate                 # também roda no postinstall
npx prisma migrate dev --name <nome>
npx prisma db seed                  # tsx prisma/seed.ts; exige SEED_ADMIN_PASSWORD (sem senha padrão)
npx prisma studio
```

**Cuidado com `npm run build`**: o script é `prisma generate && prisma migrate deploy && next build`. O `migrate deploy` aplica no banco apontado por `DATABASE_URL` as migrações pendentes de `prisma/migrations/`. Ele não apaga dados por conta própria, mas executa o SQL que estiver nas migrações. Não rode localmente apontando para um banco que não seja de desenvolvimento. Para compilar sem tocar no banco, use `npx next build`; para checar tipos, `npx tsc --noEmit`.

**Mudança de schema**: edite `prisma/schema.prisma`, rode `npx prisma migrate dev --name <nome>` contra um banco de desenvolvimento e commite a pasta gerada em `prisma/migrations/`. Nunca use `prisma db push` em banco compartilhado. `npm run db:status` mostra as migrações pendentes (só leitura).

O build da Vercel ignora erros de ESLint (`ignoreDuringBuilds: true`), então rode `npm run lint` manualmente.

## Ambiente

Copie `.env.local.example` para `.env.local`. Variáveis: `DATABASE_URL`, `AUTH_SECRET`/`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_BASE_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY` (ou `..._KEY_FILE`).

- A URL do banco fica em `prisma.config.ts`, nunca em `schema.prisma` (exigência do Prisma 7).
- `DIRECT_URL` (opcional): conexão direta usada só pela Prisma CLI nas migrações; tem prioridade sobre `DATABASE_URL` quando definida.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: Storage de arquivos, só no servidor. Nunca criar versão `NEXT_PUBLIC_`. Opcionais: `SUPABASE_BUCKET_IMAGES`, `SUPABASE_BUCKET_PROPOSALS`. Sem elas, upload e download respondem 503.
- Sem as variáveis do Google Calendar, o cronograma funciona em modo no-op (eventos só no banco local).
- Setup detalhado: `docs/SETUP.md`. Deploy: `docs/DEPLOY.md`.

## Arquitetura

```
src/
  app/
    (auth)/            login, cadastro (públicas)
    (portal)/          páginas autenticadas; layout.tsx valida a sessão
    api/               route handlers REST
    403/               página de acesso restrito
  components/
    ui/                Button, Input, Card, Modal, DataTable, Badge, Pagination, Toast (barrel em index.ts)
    layout/            PortalShell, Sidebar, sidebar-items.ts, NotificationBell
    <módulo>/          um diretório por módulo (comunicados, metas, kpis, ...)
  hooks/               usePermission, useCurrentUser, useSessionExpiredRedirect
  lib/                 auth, RBAC, prisma, regras de domínio, integrações
    validators/        schemas Zod, um arquivo por módulo
  middleware.ts
prisma/                schema.prisma, migrations/, seed.ts
tests/                 unit/, property/, e2e/
```

### Padrão de cada módulo

1. **Página** `src/app/(portal)/<modulo>/page.tsx`: Server Component com `export const dynamic = 'force-dynamic'`. Chama `auth()`, consulta o Prisma direto, converte datas para ISO string e entrega tudo a um Shell.
2. **Shell** `src/components/<modulo>/<Modulo>Shell.tsx`: Client Component (`'use client'`) com a interatividade (modais, formulários, toasts). Mutações usam `fetch` na API e depois `router.refresh()`.
3. **API** `src/app/api/<recurso>/route.ts`: handlers envolvidos por `withAuth`, com `export const runtime = 'nodejs'`.
4. **Validador** `src/lib/validators/<modulo>.ts`: schema Zod, constantes de limite e mensagens em pt-BR, compartilhado entre formulário e API.

### Autenticação

- `src/lib/auth.config.ts`: parte Edge-safe (callbacks `jwt`/`session`, sessão de 8h). O JWT carrega só `id`, `role`, `area`, `status`; `name`/`email`/`picture` são removidos de propósito para manter o cookie pequeno (erro 494 na Vercel).
- `src/lib/auth.ts`: providers (Credentials + Google), bcrypt, Prisma. Exporta `auth`, `handlers`, `signIn`, `signOut`.
- `src/lib/rate-limit.ts`: bloqueio de 15 min após 5 falhas em 15 min. `src/lib/google-auth.ts`: login Google cria conta `PENDING`.
- `src/middleware.ts` só verifica se o cookie de sessão existe. A validação real da sessão acontece em `(portal)/layout.tsx` e nas páginas via `auth()`. Uma rota privada nova precisa entrar em `PRIVATE_PREFIXES`.
- Como o JWT não tem nome nem email, busque esses dados no banco (`/api/users/me`, `useCurrentUser`).
- `role`, `area` e `status` são reconsultados no banco a cada `auth()`: o callback `jwt` de `src/lib/auth.ts` chama `refreshTokenFromDatabase` (`src/lib/session-refresh.ts`). Conta desativada, pendente, rejeitada ou removida faz `auth()` devolver `null` (páginas redirecionam para `/login`, APIs respondem 401); rebaixamento e troca de área valem na requisição seguinte. Custa uma consulta por chave primária por chamada de `auth()`.
- `session.user` já vem atualizado; `loadPermissionUser(userId)` (usado em `api/scores`) ficou redundante, mas continua funcionando.
- No cliente, `useSession`/`usePermission` só refletem a mudança quando a sessão é recarregada (foco na aba ou navegação). A proteção real é no servidor.

### RBAC

Fonte única: `src/lib/permissions.ts`.

- Papéis: `ADMIN > DIRETOR > GERENTE > COORDENADOR > MEMBRO` (`ROLE_LEVEL`). Áreas: `VENDAS`, `PRESIDENCIA`, `PROJETOS`, `MARKETING`, `GESTAO_PESSOAS`, `ADM_FIN`.
- Ações no formato `recurso:verbo` (ex.: `goal:create`, `poll:close`), tipadas no union `Action`.
- `PERMISSION_MATRIX` lista os papéis permitidos por ação. `PERMISSION_PREDICATES` acrescenta regras por atributo (área GP para infrações, mesma área para `kpi:writeValue`). A combinação é **OU**.
- Para criar uma ação: adicione ao tipo `Action` e à `PERMISSION_MATRIX` (e ao predicado, se houver).
- Servidor: `withAuth(action | null, handler, getContext?)`, `requireSession()`, `requirePermission()` em `src/lib/api-auth.ts`. `null` exige apenas sessão.
- Cliente: `usePermission('acao')` devolve `{ allowed, isLoading }`. Serve só para esconder UI; a API sempre revalida.
- Menu: `MENU_ITEMS` em `src/components/layout/sidebar-items.ts`. Só o item Admin tem `requiredAction`; restrições de ação ficam dentro de cada página.

### Contrato da API

- Sucesso: JSON com chave nomeada (`{ announcement }`, `{ announcements, pagination }`), datas em ISO string.
- Erro: `{ error: true, code, message, fields? }`, com `fields` no formato `[{ path, message }]`. Códigos: `VALIDATION_ERROR`, `INVALID_JSON`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `ACCOUNT_INACTIVE`, `SYNC_FAILED`, `INTERNAL_ERROR`.
- Mensagens de 401/403 e de login inválido são genéricas de propósito (não revelam se o email existe nem qual recurso foi negado).

### Banco de dados

- Client singleton em `src/lib/prisma.ts` (`import { prisma } from '@/lib/prisma'`); força `sslmode=require`.
- Modelos: `User`, `Event`, `Goal`, `GoalUpdate`, `Kpi`, `KpiValue`, `Project`, `Announcement`, `Poll`, `PollOption`, `PollVote`, `Infraction`, `InfractionConfig`, `Reservation`, `Service`, `Highlight`, `AlbumMember`, `Post`, `PostLike`.
- Imagens e PDFs ficam no Supabase Storage; o banco guarda só o caminho (`User.avatarPath`, `AlbumMember.photoPath`, `Highlight.photoPath`, `Project.proposalPath`). Ver "Arquivos (Supabase Storage)".
- O schema do banco é atualizado por `prisma migrate deploy` no build. `prisma/migrations/` cobre o schema atual. A migração `20260612000000_redesign_project` é idempotente porque a mudança tinha sido aplicada no banco antigo via `db push`; num banco novo ela aplica o redesenho normalmente.

### Arquivos (Supabase Storage)

- Dois buckets **privados**, sem policies: `portal-imagens` (`avatars/`, `album/`, `destaques/`, `posts/`) e `portal-propostas` (`propostas/`).
- `src/lib/storage.ts` é o único módulo que conhece a chave de serviço. Só pode ser importado por route handlers e Server Components.
- O navegador nunca acessa o Storage. Upload e download passam pelas rotas do portal, que conferem login/permissão antes.
- **Upload**: a rota chama `storeUpload` (`src/lib/upload-handler.ts`), que valida e envia; depois grava o caminho no banco e remove o arquivo anterior com `deleteFile`. Se o banco falhar, o arquivo recém-enviado é removido.
- **Validação** (`src/lib/validators/upload.ts`): tipo decidido pelo conteúdo do arquivo (assinatura), nunca por `file.type`; limite de 4 MB por causa do teto de ~4,5 MB por requisição na Vercel.
- **Download**: `GET /api/files/{avatar|album|destaque|post}/:id` (qualquer usuário logado) e `GET /api/projects/:id/proposal` (`project:readProposal`, Admin e Diretor). O caminho do arquivo é sempre lido do banco; o cliente só informa o id.
- **URLs para a tela**: as APIs devolvem `avatarUrl`/`photoUrl` já apontando para as rotas de download (`src/lib/file-urls.ts`). O caminho do bucket nunca vai ao cliente.
- **Projetos**: a listagem envia só `hasProposal` (`src/lib/projects.ts`). Escrita em projetos usa `project:write`.
- O login Google não copia mais a foto do Google para o avatar.

### Página inicial (feed)

- `/dashboard`: feed de publicações (`Post`, curtidas em `PostLike`) e coluna direita com Mural de Avisos, Destaque do Mês e Próximos Eventos. Detalhes e decisões em `docs/ROADMAP-REDESIGN.md` (Fase 2).
- Leitura e formato público em `src/lib/posts.ts` (paginação por cursor, `canDelete` calculado pela matriz) e `src/lib/home.ts` (coluna direita, datas no fuso de São Paulo).
- Publicar: `post:create`. Apagar: `post:delete`, com `context.ownerId` = autor. Curtir: qualquer usuário logado.
- O carrossel completo de destaques fica em `/destaques` (sem item no menu).

### Regras de domínio que vivem em `src/lib`

- `goals.ts`: visibilidade por área e meta vencida. `kpis.ts`, `dashboard.ts`: agregações.
- `calendar-sync.ts` + `google-calendar.ts`: sync com retry (3 tentativas, 60s), campo `Event.syncStatus`.
- `position.ts`: `MEMBRO` tem cargo fixo "Trainee"; demais papéis editam o próprio cargo.
- `area-theme.ts`: cor e mascote de cada área (álbum e banner do perfil).
- `email.ts`: emails de aprovação/rejeição via Resend.

## Specs (`.kiro/specs/portal-interno-ejmc/`)

- `requirements.md`: 20 requisitos com critérios de aceitação (referenciados no código como `Req 9.4`).
- `design.md`: arquitetura, design system, 17 propriedades de corretude (`Property N`).
- `tasks.md`: 21 tasks, todas concluídas (referenciadas como `Task 14.3`).

O código evoluiu depois das specs. **Em caso de conflito, o código vale.** Diferenças conhecidas:

- `Project` foi redesenhado: `ferramenta`, `progress`, `team` (texto), `price`, `proposalPath`. Não existem mais `ProjectStatus`, `ProjectMember` nem `ProjectStatusHistory`.
- Nomes de campo: `Event.startsAt/endsAt`, `Reservation.reservedDate`, `Infraction.userId/occurredAt/semester`, `KpiValue.recordedAt/recordedById`, `GoalUpdate.oldProgress/newProgress`.
- A matriz RBAC usa lista explícita de papéis + predicados em OU, não `minLevel` + `customCheck`. As ações são `recurso:verbo`, não `recurso.verbo`.
- Módulos fora das specs: álbum de figurinhas (`AlbumMember`, `/api/album`), destaques do dashboard (`Highlight`, `/api/highlights`), sino de notificações (`/api/notifications`), exclusão de comunicados/enquetes/metas.
- Validadores ficam em `src/lib/validators/*.ts` (não em um `validators.ts` único). Não há `src/utils` nem `tests/integration`.
- Os testes de propriedade estão agrupados por domínio (`auth`, `rbac`, `goals`, `cpf`, ...), e não um arquivo por propriedade como dizem `design.md` e `tests/property/README.md`.

## Convenções

- **Prettier**: aspas simples, ponto e vírgula, vírgula final, 100 colunas, 2 espaços, LF.
- **ESLint**: `next/core-web-vitals` + `next/typescript` + `prettier`. Variável não usada é erro, exceto com prefixo `_`.
- Componentes em PascalCase com export nomeado; utilitários e validadores em kebab/camel case. Imports sempre por `@/`.
- Rotas de página em português (`/comunicados`), rotas de API e identificadores de código em inglês (`/api/announcements`).
- Arquivos abrem com um bloco JSDoc em pt-BR explicando propósito e decisões, citando `Task`/`Req`/`Property` quando houver.
- Estilo com classes Tailwind e os tokens da seção "Identidade visual". Um token novo precisa ser mapeado em `tailwind.config.ts` (e espelhado em `globals.css`), senão a classe não gera CSS.
- Responsivo a partir de 320px; breakpoints `tablet` (768px) e `desktop` (1024px); alvos de toque de 44px no mobile.
- Reaproveite `@/components/ui` antes de criar componente base novo.
- Commits: Conventional Commits em pt-BR, sem acentos (`feat: ...`, `fix: ...`, `style: ...`). Trabalho corrente na branch `ajustes`; `main` será a branch de produção quando o deploy existir.

## Testes

- `tests/unit/`: componentes, hooks, helpers e rotas (com mocks de `auth`/Prisma).
- `tests/property/`: fast-check com `numRuns: 100`. Testam lógica pura, sem banco.
- `tests/e2e/`: Playwright em três viewports (`mobile` 320, `tablet` 768, `desktop` 1440). Login via `tests/e2e/fixtures.ts` com seletores `data-testid`. As fixtures esperam usuários `admin`, `diretor`, `coordenador` e `membro`, mas `prisma/seed.ts` só cria o admin; os outros precisam existir no banco para os E2E passarem.
- Regra de negócio nova deve nascer como função pura em `src/lib` para poder ser coberta por teste de propriedade.
