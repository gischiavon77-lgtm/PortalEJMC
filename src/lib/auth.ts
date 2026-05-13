/**
 * NextAuth.js v5 — Configuração central de autenticação
 *
 * Task 3.1: Scaffolding inicial com Credentials Provider e Google Provider.
 * Task 3.2: Lógica de login por email/senha com validação de status da conta.
 * Task 3.3: Rate limiting de tentativas de login (`src/lib/rate-limit.ts`).
 * Task 3.4: Sessão JWT com expiração por **inatividade** de 8 horas
 *           (rolling expiration). Estratégia detalhada abaixo.
 * Task 3.5: Fluxo Google OAuth — callback `signIn` decide entre criar
 *           conta pendente, linkar `googleId` em conta ativa existente,
 *           ou negar a autenticação devolvendo um redirect para
 *           `/login?error=<code>` quando a conta está em status
 *           PENDING/INACTIVE/REJECTED. A lógica de banco vive em
 *           `src/lib/google-auth.ts` (helper `findOrCreateGoogleUser`).
 *
 * ─── Estratégia de expiração por inatividade (Task 3.4 / Req 1.1, 1.3) ───
 *
 * O requisito é "sessão com duração máxima de 8 horas de inatividade":
 * cada interação autenticada deve renovar a janela; só após 8h sem
 * qualquer atividade é que o usuário deve ser deslogado. Isto é
 * **rolling expiration**, não um TTL absoluto.
 *
 * NextAuth oferece dois parâmetros nativos para JWT:
 *   - `session.maxAge`   → tempo de vida do cookie/JWT antes de expirar.
 *   - `session.updateAge`→ intervalo mínimo entre re-emissões do JWT
 *                         (com `exp` recalculado a partir de `maxAge`).
 *
 * Se usássemos apenas `maxAge=8h` com `updateAge` padrão (24h), o JWT
 * seria reemitido raramente e poderia expirar em 8h **absolutas**,
 * mesmo com o usuário ativo — comportamento errado.
 *
 * Solução adotada (rolling robusto):
 *   1. `maxAge = 8h`         — limite absoluto entre reemissões.
 *   2. `updateAge = 0`       — toda chamada a `jwt` reemite o cookie
 *                              com `exp = agora + maxAge`, garantindo
 *                              janela rolante a cada atividade.
 *   3. Guarda manual         — o callback `jwt` registra
 *                              `token.lastActivity = Date.now()` e, em
 *                              chamadas subsequentes, rejeita o token
 *                              se a última atividade foi há mais de 8h
 *                              (defesa contra cookies persistidos
 *                              localmente sem trip pelo middleware ou
 *                              relógios divergentes).
 *
 * O guard manual cobre cenários onde `maxAge` não bastaria sozinho:
 *   - Ambientes em que o cookie tem expiração estendida pelo navegador
 *     (fuso ou clock skew),
 *   - Tokens replicados/copiados antes da reemissão,
 *   - Mudanças futuras em `maxAge`/`updateAge` que pudessem regredir o
 *     comportamento sem que a regra de negócio (8h de inatividade) fosse
 *     comprometida.
 *
 * Quando o guard determina inatividade, retornamos `null` do callback
 * `jwt`. O NextAuth interpreta isto como sessão inválida, removendo o
 * cookie e forçando o redirecionamento para `/login` (Req 1.3 / Task 4.6).
 *
 * Observação: não persistimos `lastActivity` no banco a cada chamada
 * (o JWT é a fonte da verdade aqui) para evitar pressão de I/O em todas
 * as requisições autenticadas. A coluna `User.lastActivity` permanece
 * disponível para auditoria/relatórios futuros e poderá ser atualizada
 * em pontos específicos (ex.: heartbeat dedicado).
 *
 * ─── Outras decisões de Task 3 já consolidadas ───────────────────────
 *   - Validar email + senha contra `prisma.user` usando `bcrypt.compare`
 *     com mensagem de erro genérica preservando indistinguibilidade
 *     entre email inexistente e senha incorreta (Property 1, Req 1.2).
 *     Task 3.11 expõe a mensagem ao cliente.
 *   - Validação de status da conta — Task 3.2:
 *       · `ACTIVE`   → autentica e retorna o usuário enriquecido.
 *       · `PENDING`  → lança `AccountPendingError`  (code: `AccountPending`).
 *       · `INACTIVE` → lança `AccountInactiveError` (code: `AccountInactive`).
 *       · `REJECTED` → lança `AccountRejectedError` (code: `AccountRejected`).
 *     A checagem ocorre **depois** da validação de senha, garantindo que
 *     mensagens específicas só são reveladas a quem prova posse da
 *     credencial (preserva a Property 1 / Req 1.2). Em complemento, os
 *     códigos são distintos para o ErrorCode unificado `ACCOUNT_INACTIVE`
 *     do tratamento de erros descrito no design — a UI (`/login`,
 *     Task 3.8) mapeia cada código para uma mensagem amigável
 *     ("aguardando aprovação", "conta desativada", "solicitação recusada").
 *   - Rate limiting (Task 3.3): a lógica de bloqueio (5 tentativas em
 *     15 minutos com lockout de 15 min) vive em `src/lib/rate-limit.ts`.
 *     `authorize` consulta `checkLockedOut` antes de validar a senha;
 *     se há bloqueio ativo, lança `AccountLockedError` com código
 *     `AccountLocked` para a UI exibir a mensagem específica.
 *     Falhas de senha incrementam o contador via `registerFailedAttempt`.
 *     Login bem-sucedido limpa o estado via `resetFailedAttempts`.
 *     Importante: tentativas que falham por status (PENDING/INACTIVE/
 *     REJECTED) **não** incrementam o contador — a senha estava correta
 *     e o usuário é dono da conta, não há risco de ataque por força bruta.
 *   - Google Provider (Task 3.5): além de configurar o provider, o callback
 *     `signIn` consulta `findOrCreateGoogleUser` para classificar a tentativa
 *     em `allow` / `pending` / `inactive` / `rejected` / `invalid`. Em
 *     cenários distintos de `allow` retornamos uma string de redirect
 *     (`/login?error=<code>`) para que a UI exiba a mensagem específica;
 *     ainda assim, NextAuth interrompe o login (não emite cookie de sessão).
 *     O callback `jwt` é estendido para enriquecer o token com os campos
 *     de domínio (`role`, `area`, `status`) lidos do banco quando o
 *     primeiro login não veio do Credentials.authorize (caso Google).
 *   - Callbacks JWT/session expõem `id`, `role`, `area`, `status`.
 *
 * Padrão NextAuth v5: este módulo exporta `auth`, `handlers`, `signIn`,
 * `signOut` para serem consumidos em route handlers, server components,
 * server actions e middleware.
 */

import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import type { AccountStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  checkLockedOut,
  registerFailedAttempt,
  resetFailedAttempts,
} from '@/lib/rate-limit';
import { findOrCreateGoogleUser } from '@/lib/google-auth';
import { AUTH_ERROR_CODES } from '@/lib/auth-errors';
import { authConfig as edgeAuthConfig } from '@/lib/auth.config';

/**
 * Códigos de erro emitidos pelo Credentials Provider para sinalizar
 * contas que foram autenticadas com sucesso (senha correta) mas que
 * estão com status diferente de `ACTIVE`. Estes códigos são consumidos
 * pela página de login (Task 3.8) para exibir a mensagem específica
 * conforme Req 1.5, 3.3 e Property 3.
 *
 * Os valores são propagados pelo NextAuth como `?error=<code>` na URL
 * de retorno do `signIn`, ou como `error.code` no resultado do
 * `signIn(...)` server action.
 *
 * As constantes vivem em `@/lib/auth-errors` para que o cliente (Task
 * 3.8) possa importá-las sem arrastar Prisma/bcrypt para o bundle do
 * navegador. Reexportamos aqui para preservar a API pública do módulo.
 */
export { AUTH_ERROR_CODES };

export class AccountPendingError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.ACCOUNT_PENDING;
}

export class AccountInactiveError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
}

export class AccountRejectedError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.ACCOUNT_REJECTED;
}

/**
 * Lançado quando o email está bloqueado pelo rate limiter (Task 3.3 /
 * Property 2 / Req 1.4). A UI (Task 3.8) mapeia o código para a mensagem
 * "Conta bloqueada por excesso de tentativas. Tente novamente em alguns
 * minutos." Não revelamos `lockedUntil` exato para evitar facilitar
 * ataques de timing por enumeração.
 */
export class AccountLockedError extends CredentialsSignin {
  code = AUTH_ERROR_CODES.ACCOUNT_LOCKED;
}

export const authConfig: NextAuthConfig = {
  // Reaproveita session.strategy/maxAge/updateAge, secret, pages e os
  // callbacks `jwt`/`session` definidos em `auth.config.ts` (Edge-safe).
  // Aqui adicionamos o que depende de Node (Prisma + bcrypt + helpers
  // de banco): a lista de providers e o callback `signIn` do Google.
  ...edgeAuthConfig,

  providers: [
    // ─── Credentials: email + senha ───────────────────────────────────────
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === 'string'
            ? credentials.email.trim().toLowerCase()
            : '';
        const password =
          typeof credentials?.password === 'string'
            ? credentials.password
            : '';

        if (!email || !password) {
          return null;
        }

        // Task 3.3: rate limiting. Se o email já está em bloqueio ativo
        // (5 falhas em 15 min → 15 min de lockout), recusamos a tentativa
        // antes de tocar no hash de senha. Lançamos AccountLockedError
        // para que a UI exiba a mensagem específica (Req 1.4 / Property 2).
        // Para emails inexistentes `checkLockedOut` retorna { blocked: false }
        // (não revelamos existência da conta).
        const { blocked } = await checkLockedOut(email);
        if (blocked) {
          throw new AccountLockedError();
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Mensagem genérica (Task 3.11): qualquer falha — email inexistente,
        // senha incorreta, conta não-ativa, conta sem senha (somente Google) —
        // resulta em `null` para que o NextAuth retorne CredentialsSignin
        // sem revelar qual campo falhou. O lado cliente do contrato vive
        // em `src/components/auth/login-error-messages.ts` (resolveErrorMessage):
        // qualquer código não mapeado também é convertido na mesma mensagem
        // genérica, fechando a Property 1 (Req 1.2). Coberto por
        // `tests/unit/login-error-messages.test.ts`.
        if (!user || !user.passwordHash) {
          await registerFailedAttempt(email);
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          await registerFailedAttempt(email);
          return null;
        }

        // Task 3.2: validação de status da conta. A senha já foi validada,
        // então é seguro revelar o motivo específico — somente o dono da
        // conta consegue chegar até aqui (Property 1 / Req 1.2 preservadas).
        // Os contadores de rate limiting NÃO são incrementados nesses
        // casos: o usuário possui as credenciais, não há tentativa de
        // intrusão por força bruta.
        const status: AccountStatus = user.status;
        switch (status) {
          case 'ACTIVE':
            break;
          case 'PENDING':
            // Req 3.3: enquanto aguarda aprovação, login é bloqueado.
            throw new AccountPendingError();
          case 'INACTIVE':
            // Req 1.5 + 4.6: conta desativada por administrador.
            throw new AccountInactiveError();
          case 'REJECTED':
            // Req 3.5: cadastro recusado pelo administrador.
            throw new AccountRejectedError();
          default: {
            // Defensivo: novos status no enum sem mapeamento explícito
            // são tratados como inativos, em vez de permitir acesso.
            const _exhaustive: never = status;
            void _exhaustive;
            throw new AccountInactiveError();
          }
        }

        await resetFailedAttempts(user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl ?? null,
          role: user.role,
          area: user.area,
          status: user.status,
        };
      },
    }),

    // ─── Google OAuth ─────────────────────────────────────────────────────
    // Provider OAuth2 oficial. O fluxo de criação/linkagem de conta e
    // controle de status é executado pelo callback `signIn` abaixo,
    // delegando a lógica de banco a `findOrCreateGoogleUser`.
    //
    // `allowDangerousEmailAccountLinking: false` mantém o
    // comportamento padrão do NextAuth de não vincular automaticamente
    // contas pelo email — nós controlamos a vinculação manualmente
    // dentro de `findOrCreateGoogleUser`, e apenas para contas ACTIVE.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],

  callbacks: {
    // Reaproveita os callbacks `jwt` e `session` da config Edge — única
    // fonte da verdade para a política de inatividade de 8h e para o
    // shape da Session. `signIn` é definido apenas aqui porque depende
    // de `findOrCreateGoogleUser` (Prisma), que não pode rodar no Edge.
    ...edgeAuthConfig.callbacks,
    /**
     * Callback `signIn` (Task 3.5).
     *
     * Para Credentials, retornamos `true` — toda a validação já ocorreu
     * em `authorize()` (rate limit, senha, status). O retorno desse
     * callback não é alcançado em falhas do Credentials porque
     * `authorize()` já lançou `CredentialsSignin` (mapeado para
     * `?error=<code>` pela própria NextAuth).
     *
     * Para Google:
     *   - `allow`    → retornamos `true` e enriquecemos `user` com os
     *                  campos do banco para que o callback `jwt` herde
     *                  `id`, `role`, `area`, `status` corretamente.
     *   - `pending`  → retornamos a URL `/login?error=AccountPending`
     *                  para redirecionar o usuário com mensagem específica.
     *   - `inactive` → idem, com `error=AccountInactive`.
     *   - `rejected` → idem, com `error=AccountRejected`.
     *   - `invalid`  → retornamos `false` (NextAuth dispara
     *                  `AccessDenied` na URL de erro).
     *
     * Devolver uma string de redirect aqui é suportado pelo NextAuth e é
     * preferível a `false` quando queremos comunicar o motivo: o cookie
     * de sessão nunca é emitido (login bloqueado) e a UI recebe o
     * código via query string para exibir a mensagem correta. Isso
     * cumpre Req 2.3 (mensagem "aguardando aprovação" para conta nova),
     * Req 2.4 (mensagem para conta pendente) e Req 1.5 (conta inativa).
     */
    async signIn({ user, account, profile }) {
      // Credentials: toda a lógica já está em `authorize()`.
      if (!account || account.provider !== 'google') {
        return true;
      }

      if (!profile) {
        return `/login?error=${AUTH_ERROR_CODES.ACCOUNT_INACTIVE}`;
      }

      const outcome = await findOrCreateGoogleUser(profile);

      switch (outcome.kind) {
        case 'invalid':
          // Profile sem email/sub: nega sem revelar detalhes.
          return false;
        case 'pending':
          return `/login?error=${AUTH_ERROR_CODES.ACCOUNT_PENDING}`;
        case 'inactive':
          return `/login?error=${AUTH_ERROR_CODES.ACCOUNT_INACTIVE}`;
        case 'rejected':
          return `/login?error=${AUTH_ERROR_CODES.ACCOUNT_REJECTED}`;
        case 'allow': {
          // Sobrescreve `user` (o objeto repassado ao callback `jwt`)
          // com os dados canônicos do banco. Sem isso, o `id` que chega
          // ao `jwt` é o `sub` do Google, e os campos de domínio
          // (role/area/status) ficariam ausentes.
          user.id = outcome.user.id;
          user.name = outcome.user.name;
          user.email = outcome.user.email;
          user.image = outcome.user.avatarUrl ?? user.image ?? null;
          user.role = outcome.user.role;
          user.area = outcome.user.area;
          user.status = outcome.user.status;
          return true;
        }
        default: {
          const _exhaustive: never = outcome;
          void _exhaustive;
          return false;
        }
      }
    },
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
