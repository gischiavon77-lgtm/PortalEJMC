# Roteiro da reforma do Portal EJMC

Reforma visual e funcional do portal, feita em fases na branch `redesign`.
**Leia este arquivo no início de cada sessão para saber o que falta.**

| Fase | Tema                      | Situação     |
| ---- | ------------------------- | ------------ |
| 0    | Pré-requisito: Storage    | ✅ Concluída |
| 1    | Base visual               | ✅ Concluída |
| 2    | Página inicial em feed    | ✅ Concluída |
| 3    | Projetos (estilo "Radar") | ✅ Concluída |
| 4    | Calendário                | ✅ Concluída |
| 5    | Estrutura (organograma)   | ⏳ Pendente  |

Ao concluir uma fase, atualize a tabela acima e a seção da fase (situação e commit).

## Regras (valem para todas as fases)

- Um commit por fase. Antes de cada fase, apresentar o plano e aguardar aprovação.
- Mudanças de banco sempre via migração do Prisma. Depois de criar uma migração, lembrar o usuário de rodar `npx prisma migrate deploy`.
- Seguir a identidade visual aplicada na Fase 1: League Spartan branca e em negrito nos títulos, Montserrat no restante sem maiúsculas, `#87000a` como única cor de destaque, tema escuro. Detalhes e tokens na seção "Identidade visual" do `CLAUDE.md`.
- Não alterar permissões nem autenticação, exceto onde a fase indicar.
- Ao final de cada fase: testes, lint e checagem de tipos.

## Fase 0 — Pré-requisito ✅

**Situação:** concluída no código (commit `6142a5b`).

Avatares e arquivos deixam de ser gravados em base64 no banco e passam para o Supabase Storage; o banco guarda só o caminho. Pré-requisito das fases 2 e 3.

Pendente fora do código: criar os buckets no Supabase real e definir as variáveis (ver Fase 2).

## Fase 1 — Base visual ✅

**Situação:** concluída (commits `0f96295`, `dce9a95` e `f8969dd`).

- Identidade EJMC no site inteiro, inclusive login: League Spartan e Montserrat via `next/font/google`, `#87000a` como única cor de destaque.
- Tema escuro único, fundo chapado, sem degradês, vidro nem sombras fortes; sem alternância de tema.
- Tokens centralizados em `tailwind.config.ts` e `globals.css`.
- Componentes: `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`; `Button` principal em `#87000a`.
- Sidebar fixa na altura toda, com logo, etiqueta de cargo e sino no topo, grupos com divisórias e avatar/nome/área/sair no rodapé. No celular vira menu recolhível. Sem barra superior a partir de 768px.
- Destaque ao passar o mouse (`hover-card`): a caixa escurece e a borda fica em `#87000a`.

## Fase 2 — Página inicial em feed ✅

**Situação:** concluída (commit da Fase 2). Migração `20261120000000_feed_posts` (tabelas `Post` e `PostLike`): rodar `npx prisma migrate deploy` em cada banco.

O que foi feito e decisões aprovadas:

- Storage real conferido antes de começar: os dois buckets existem e são privados; envio, download e remoção testados nos dois.
- `/dashboard` virou o feed: `HomeFeed`, `PostCard`, `PostComposer` e `HomeSidebar` em `src/components/home/`; leitura em `src/lib/posts.ts` e `src/lib/home.ts`.
- API: `GET/POST /api/posts` (paginação por cursor, 10 por página), `DELETE /api/posts/:id`, `POST/DELETE /api/posts/:id/like`, imagem em `GET /api/files/post/:id` (pasta `posts/` do bucket de imagens).
- Permissões: `post:create` (Coordenador+) e `post:delete` (Diretor e Admin pela matriz; autor pelo predicado com `context.ownerId`). `PermissionUser` ganhou `id` opcional.
- Mural de Avisos: comunicados dos últimos 30 dias, os 3 mais recentes (comunicados não têm data de validade).
- Destaque do Mês: os cinco destaques principais; o carrossel completo (com Referências e Prêmio Cultura) foi para `/destaques`, aberto pelo link do card. A permissão dos destaques continua `album:manage`; renomear para `highlight:manage` na Fase 5.
- Responsivo: três colunas a partir de 1280px; abaixo disso a coluna direita vem antes do feed.

Escopo original:

**Pré-requisito:** verificar se o Supabase Storage real está configurado (buckets criados e variáveis no `.env`). Se não estiver, dar o passo a passo e testar o upload de um avatar antes de seguir.

Substituir o dashboard atual (carrossel de destaques) por três colunas: sidebar | feed central | coluna lateral direita.

- **Feed central:** posts com autor (avatar, nome, cargo, área), data, texto e uma imagem opcional. Mais recentes primeiro, com paginação.
- **Curtidas:** qualquer membro ativo pode curtir e descurtir; mostrar a contagem.
- **Quem pode postar:** COORDENADOR, GERENTE, DIRETOR e ADMIN. Definir na matriz de permissões, para ser fácil de mudar depois.
- **Quem pode apagar:** o autor, DIRETOR e ADMIN.
- Sem comentários nesta versão.
- **Imagem:** validar tipo e tamanho no servidor; salvar no Storage.
- **Coluna direita, três cards:**
  - (a) Mural de Avisos: comunicados ativos mais recentes;
  - (b) Destaque do Mês: reaproveitar os destaques existentes;
  - (c) Próximos Eventos: os próximos eventos do calendário, com dia, mês, título e horário.
- Cada card com estado vazio quando não houver conteúdo.

## Fase 3 — Projetos (estilo "Radar") ✅

**Situação:** concluída (commit da Fase 3). Migração `20261121000000_projects_radar`: rodar `npx prisma migrate deploy` em cada banco.

O que foi feito e decisões aprovadas:

- `Project` ganhou `description`, `status` (`EM_ANDAMENTO`/`CONCLUIDO`) e `bannerPath`; a equipe virou a tabela `ProjectMember` ligada a usuários.
- Saíram `team` (texto livre) e `progress` (0-100%). Não havia projetos cadastrados; a migração ainda converte 100% em "concluído" por segurança.
- Listagem (`GET /api/projects`) nunca traz preço nem proposta, para ninguém. Detalhes (`GET /api/projects/:id`) trazem `management` (preço e se há proposta) só para `project:write`.
- Equipe só aceita usuários ativos; desativados continuam ligados, mas somem da tela.
- "Pessoas envolvidas" = pessoas distintas (ativas) nos projetos em andamento.
- "Ver detalhes" abre uma janela sobre a lista; Editar e Excluir ficam nela, para a gestão.
- Banner no Storage (`projetos/` do bucket de imagens), servido por `/api/files/projeto/:id`.
- Permissões inalteradas: `project:write` e `project:readProposal` (Admin e Diretor).

Escopo original:

- **Topo:** cards de número com "em andamento", "concluídos" e "pessoas envolvidas".
- **Grade de cards:** banner (imagem opcional), etiquetas de ferramenta e de status, nome, descrição curta, equipe alocada e "Ver detalhes".
- **Novos campos:** descrição, status (em andamento / concluído) e imagem do banner.
- **Equipe:** trocar o texto livre por vínculo com usuários cadastrados. Propor como tratar os projetos já existentes.
- Botão "Novo projeto" abrindo formulário com banner, ferramenta, descrição e equipe.
- **Preço e proposta em PDF:** visíveis apenas para quem já tem permissão de gestão de projetos, nunca na listagem geral.

## Fase 4 — Calendário ✅

**Situação:** concluída (commit da Fase 4). Migração `20261122000000_event_categories`: rodar `npx prisma migrate deploy` em cada banco.

O que foi feito e decisões aprovadas:

- Enum `EventCategory` e campo `Event.category`. Categorias: Institucional, Reunião de área, Projetos e clientes, Comercial, Capacitação, Processo seletivo, Eventos e integração, Outros. Nomes, dicas e cores em `src/lib/event-categories.ts`; tokens `cat-*` (tons apagados, sem o vermelho da marca).
- Eventos que já existiam ficaram em "Outros"; eventos novos sugerem "Institucional". Na API a categoria é opcional (padrão do banco: "Outros").
- Tela: cabeçalho "Cronograma" (`PageHeader`) com "Novo evento"; filtros por categoria (uma por vez; no celular, linha rolável); navegação de mês no topo do calendário; eventos com ponto e fundo leve da categoria; legenda embaixo.
- Formulário e detalhes do evento mostram a categoria; "Próximos Eventos" da página inicial também.
- A categoria fica só no portal: a sincronização com o Google é só de ida e não envia a categoria.
- Testes: integração com banco em memória (`tests/unit/calendar-home-integration.test.ts`, roda em `npm test`) e E2E (`tests/e2e/calendar.spec.ts`, exige banco com seed e o usuário de teste "coordenador").

Escopo original:

- Manter o funcionamento atual, com o visual novo.
- Adicionar categoria ao evento, com cor, legenda e filtros no topo. Propor as categorias adequadas a uma empresa júnior.
- Garantir, com teste automatizado, que um evento futuro criado no calendário aparece em "Próximos Eventos" na página inicial.

## Fase 5 — Estrutura (organograma) ⏳

Substituir a tela de membros/álbum por "Estrutura".

- **Visão geral:** cards de número (membros, áreas) e um card por área com a contagem de membros.
- **Ao clicar em uma área:** organograma em camadas, de cima para baixo: Diretor > Gerentes > Coordenadores > Membros. Cada pessoa em um card com foto, nome e cargo.
- **Fonte dos dados:** usuários ATIVOS reais (área e nível). Conta aprovada aparece automaticamente; conta desativada some.
- O nível MEMBRO cobre trainees e assessores: exibir o campo de cargo no card.
- Remover a galeria/álbum por gestão e o modelo `AlbumMember`, com a migração correspondente. **Confirmar com o usuário antes de apagar.**
- Não criar tela de diretório com busca e filtros.

## Fora do escopo

Diretório & Alumni, comentários no feed, código de ativação, trilhas, tarefas, performance e tema claro.
