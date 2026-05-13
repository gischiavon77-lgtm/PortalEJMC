/**
 * Catálogo declarativo dos itens do menu lateral (Task 5.1).
 *
 * Mantemos os itens em um módulo separado do componente `Sidebar` por
 * três motivos pragmáticos:
 *
 *   1. **Single source of truth** — qualquer outro consumidor (ex.: a
 *      Topbar futura, breadcrumbs, ou testes de propriedade da Task
 *      20.9 que verifica visibilidade do menu por papel) lê desta
 *      mesma estrutura. Replicar a lista em vários lugares só convida
 *      desvios silenciosos.
 *
 *   2. **Testabilidade** — o teste do componente em
 *      `tests/unit/Sidebar.test.tsx` se apoia em `MENU_ITEMS` para
 *      enumerar os itens esperados (em vez de hard-codear strings),
 *      tornando o teste robusto a renomeações.
 *
 *   3. **Sem JSX no `.ts`** — usar nomes de ícones (string literais)
 *      em vez de elementos React permite que este arquivo seja um
 *      módulo TypeScript puro, livre de JSX. O componente `Sidebar`
 *      faz o mapeamento `name → SVG` ao renderizar.
 *
 * ─── Sobre `requiredAction` e a Property 8 (Req 5.3) ─────────────────
 *
 * O segundo parâmetro `requiredAction` referencia uma `Action` da
 * matriz RBAC central (`@/lib/permissions`). Quando presente, o
 * `Sidebar` esconde o item se `hasPermission(user, action) === false`.
 * Isso satisfaz Req 5.3 ("ocultar do menu de navegação os itens para
 * os quais o Usuário não possui permissão") e a Property 8 ("a
 * visibilidade do menu corresponde exatamente à matriz RBAC").
 *
 * Observação importante sobre quais itens recebem `requiredAction`:
 *
 *   - **Admin** é o único módulo restrito por papel — somente ADMIN
 *     o vê (`admin:access`). Todos os demais módulos têm conteúdo
 *     visualizável por qualquer membro autenticado, mesmo que algumas
 *     **ações dentro deles** (criar metas, alterar projeto, registrar
 *     infração) sejam restritas a papéis específicos. Ocultar um
 *     módulo do menu apenas porque o usuário não pode *criar* algo
 *     ali violaria os requisitos de leitura — por exemplo, Req 18.5
 *     diz que qualquer usuário acessa "sua própria pontuação", e Req
 *     9.4 dá acesso de leitura a metas a todos.
 *
 *   - Restrições por *área* (ex.: registrar infração só por GP) são
 *     refinadas dentro da própria página/ação, não na visibilidade
 *     do item. Esse limite preserva a propriedade de "menu reflete
 *     RBAC" sem complicá-la com regras por atributo do usuário.
 *
 * ─── Sobre o conjunto de ícones ──────────────────────────────────────
 *
 * `SidebarIconName` é um union de string literals fechado. O `Sidebar`
 * renderiza um SVG por nome — TypeScript garante que adicionar um item
 * com um nome novo exija também atualizar o componente (caso contrário
 * o build quebra). Esse "lock" evita ícones faltando em produção.
 */

import type { Action } from '@/lib/permissions';

/**
 * Conjunto fechado de nomes de ícones usados pelo `Sidebar`. Cada nome
 * mapeia para um SVG inline definido no componente — reaproveitamos
 * formatos universais (Lucide-like / Feather-like) para manter
 * coerência visual entre os 14 itens.
 */
export type SidebarIconName =
  | 'home'
  | 'calendar'
  | 'target'
  | 'chart'
  | 'users'
  | 'briefcase'
  | 'folder'
  | 'megaphone'
  | 'vote'
  | 'alert'
  | 'monitor'
  | 'user'
  | 'settings'
  | 'shield';

/**
 * Descreve um item do menu lateral.
 *
 * - `label`: rótulo visível em pt-BR.
 * - `href`: rota App Router (sempre absoluta, com `/` inicial).
 * - `icon`: identificador do SVG renderizado pelo `Sidebar`.
 * - `requiredAction` (opcional): ação RBAC necessária para que o item
 *   apareça. Sem essa chave, o item é visível a qualquer sessão
 *   autenticada — política consistente com Req 5.3.
 */
export interface SidebarItem {
  readonly label: string;
  readonly href: string;
  readonly icon: SidebarIconName;
  readonly requiredAction?: Action;
}

/**
 * Itens do menu na ordem de exibição. A ordem corresponde ao desenho
 * em `design.md` (Dashboard primeiro; Admin sempre por último). Os
 * módulos pessoais (Perfil, Configurações) ficam logo antes do
 * grupo administrativo, para criar uma transição natural entre
 * "minhas ferramentas" e "administração do sistema".
 *
 * Tipado como `readonly` para impedir mutações acidentais em runtime
 * — esta lista é compartilhada entre o componente e os testes, então
 * imutabilidade dá garantias mais fortes do que comentários.
 */
export const MENU_ITEMS: readonly SidebarItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'home' },
  { label: 'Cronograma', href: '/cronograma', icon: 'calendar' },
  { label: 'Metas', href: '/metas', icon: 'target' },
  { label: 'KPIs', href: '/kpis', icon: 'chart' },
  { label: 'Membros', href: '/membros', icon: 'users' },
  { label: 'Portfólio', href: '/portfolio', icon: 'briefcase' },
  { label: 'Projetos', href: '/projetos', icon: 'folder' },
  { label: 'Comunicados', href: '/comunicados', icon: 'megaphone' },
  { label: 'Enquetes', href: '/enquetes', icon: 'vote' },
  { label: 'Pontuação', href: '/pontuacao', icon: 'alert' },
  { label: 'Reservas', href: '/reservas', icon: 'monitor' },
  { label: 'Perfil', href: '/perfil', icon: 'user' },
  { label: 'Configurações', href: '/configuracoes', icon: 'settings' },
  { label: 'Admin', href: '/admin', icon: 'shield', requiredAction: 'admin:access' },
] as const;
