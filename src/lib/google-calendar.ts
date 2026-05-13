/**
 * Integração Google Calendar API v3 — Task 7.1.
 *
 * Wrapper fino sobre `googleapis` que encapsula as 4 operações usadas
 * pelo módulo Cronograma:
 *
 *   - `createGoogleEvent`  → cria evento no calendário compartilhado.
 *   - `updateGoogleEvent`  → atualiza título/datas.
 *   - `deleteGoogleEvent`  → remove evento.
 *   - `listGoogleEvents`   → lista eventos numa janela `[start, end)`.
 *
 * O calendário-alvo é resolvido via `GOOGLE_CALENDAR_ID` (uma única
 * agenda compartilhada da EJMC). O Req 8 não fala em múltiplos
 * calendários, então mantemos a configuração simples e explícita.
 *
 * ─── Autenticação (Service Account) ──────────────────────────────────
 *
 * O acesso server-to-server à Google Calendar API exige um Service
 * Account com a credencial JSON. Aceitamos duas formas, nessa ordem
 * de precedência:
 *
 *   1. `GOOGLE_SERVICE_ACCOUNT_KEY`      — JSON da credencial inline
 *      (ideal para Vercel, onde arquivos não persistem entre invocações).
 *   2. `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` — caminho para o arquivo JSON
 *      (útil em desenvolvimento local).
 *
 * O Service Account precisa ser convidado como editor do
 * `GOOGLE_CALENDAR_ID` no Google Calendar — sem isso, todas as
 * chamadas devolvem 403 mesmo com credencial válida.
 *
 * ─── Modo no-op (sem credenciais) ────────────────────────────────────
 *
 * Quando `GOOGLE_CALENDAR_ID` está ausente OU a credencial não está
 * configurada, o módulo entra em **modo no-op**:
 *
 *   - `createGoogleEvent` devolve `{ googleEventId: null, mode: 'noop' }`.
 *   - `updateGoogleEvent`/`deleteGoogleEvent` resolvem silenciosamente.
 *   - `listGoogleEvents` devolve `[]`.
 *
 * Esse comportamento permite rodar a aplicação em desenvolvimento e nos
 * testes sem provisionar credenciais Google. Os callers (API routes da
 * Task 7.2) precisam apenas saber que `googleEventId` pode ser `null`
 * — nesse caso o evento existe somente no banco local. Em produção,
 * a configuração ausente é sinalizada por warning único no `console`.
 *
 * **Importante:** modo no-op NÃO é o mesmo que falha de sincronização.
 * - No-op: configuração ausente → `syncStatus = 'synced'` no DB
 *   (o evento "está em dia" — não há para onde sincronizar).
 * - Falha: API Google indisponível → `syncStatus = 'failed'`,
 *   `syncRetries = 0`, retentativa via `retrySyncEvents()`.
 *
 * ─── Retry inline (curto) ────────────────────────────────────────────
 *
 * O Req 8.7 fala em "até 3 tentativas com intervalo de 60 segundos"
 * para a sincronização *automática posterior*. Em chamadas inline
 * (durante o request HTTP do usuário), 60s × 3 = 3 minutos é
 * inviável — o cliente faz timeout muito antes. Adotamos um meio-termo:
 *
 *   - **Inline (este módulo)**: até 2 tentativas com backoff curto
 *     (200ms, 1s), totalizando ~1.2s no pior caso. Cobre erros
 *     transitórios (rede instável, 503, rate limit pontual) sem
 *     bloquear o usuário.
 *   - **Background (Task 7.3)**: o `retrySyncEvents()` em
 *     `@/lib/calendar-sync` reaplica as 3 tentativas espaçadas em
 *     ~60s — o intervalo do requisito vive nessa camada externa.
 *
 * Esse trade-off é coerente com o Req 8.2 (sincronização em até 30s)
 * e o Req 8.7 (3 tentativas posteriores) — o usuário não espera 3min
 * mas a robustez é preservada via retentativa de fundo.
 *
 * ─── Erro tipado (`GoogleCalendarError`) ─────────────────────────────
 *
 * Quando todas as tentativas inline falham, lançamos
 * `GoogleCalendarError`. O caller (API route) pega esse erro e marca
 * `syncStatus = 'failed'` no banco — ver Task 7.4. Diferenciamos do
 * caminho no-op (que NÃO lança) para que o caller saiba a diferença
 * entre "não há nada para fazer" e "falhou, precisa de retry".
 */

import { google, type calendar_v3 } from 'googleapis';

// ─── Tipos públicos ──────────────────────────────────────────────────

/**
 * Payload mínimo para criar/atualizar um evento no Google Calendar.
 * Espelha o shape das colunas relevantes em `Event` (`title`,
 * `startsAt`, `endsAt`) — manter os nomes alinhados ao schema Prisma
 * evita conversões redundantes na camada superior.
 */
export interface GoogleEventInput {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** Descrição opcional. Reservado para uso futuro pela UI. */
  description?: string;
}

/**
 * Resultado de `createGoogleEvent`. Em modo no-op, `googleEventId`
 * vem como `null` — o caller deve gravar isso no DB e tratar como
 * "evento sem espelho remoto".
 */
export interface CreateGoogleEventResult {
  googleEventId: string | null;
  /** `'live'` quando a Google API foi de fato acionada; `'noop'`
   *  quando o módulo está em modo sem credenciais. */
  mode: 'live' | 'noop';
}

/** Item retornado por `listGoogleEvents`. */
export interface GoogleCalendarEvent {
  googleEventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  description: string | null;
}

/**
 * Erro tipado lançado quando uma chamada à Google API falha após o
 * retry inline. Mantém a `cause` original para diagnóstico nos logs
 * sem expor detalhes ao cliente HTTP — a API route converte isso em
 * 502/503 + `syncStatus='failed'`.
 */
export class GoogleCalendarError extends Error {
  readonly code = 'GOOGLE_CALENDAR_ERROR' as const;
  readonly status: number | undefined;
  constructor(message: string, options?: { cause?: unknown; status?: number }) {
    super(message, options);
    this.name = 'GoogleCalendarError';
    this.status = options?.status;
  }
}

// ─── Configuração e client lazy ──────────────────────────────────────

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/** Cache do client. `undefined` = ainda não resolvido; `null` = no-op. */
let cachedClient: calendar_v3.Calendar | null | undefined;
/** Garante que o warning do modo no-op aparece apenas uma vez. */
let warnedAboutNoop = false;

/**
 * Identifica o calendário alvo. `null` quando `GOOGLE_CALENDAR_ID`
 * está ausente — sinal de que devemos operar em modo no-op.
 */
function getCalendarId(): string | null {
  const value = process.env.GOOGLE_CALENDAR_ID?.trim();
  return value ? value : null;
}

/**
 * Resolve as credenciais do Service Account em runtime. Centralizado
 * para que `getCalendarClient` permaneça pequeno e para facilitar
 * testes futuros (basta mockar essa função).
 *
 * Retorna `null` quando nenhuma das fontes está configurada — mesmo
 * caminho do modo no-op.
 */
function resolveServiceAccountAuth(): InstanceType<typeof google.auth.GoogleAuth> | null {
  const inlineKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (inlineKey) {
    try {
      const credentials = JSON.parse(inlineKey);
      return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    } catch (err) {
      console.error(
        '[google-calendar] GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido — operando em modo no-op:',
        err,
      );
      return null;
    }
  }

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (keyFile) {
    return new google.auth.GoogleAuth({ keyFile, scopes: SCOPES });
  }

  return null;
}

/**
 * Resolve (lazy) o client `calendar_v3.Calendar`. Em modo no-op,
 * retorna `null` e emite warning único. Exportado para testes via
 * `__resetGoogleCalendarClientForTests`.
 */
function getCalendarClient(): calendar_v3.Calendar | null {
  if (cachedClient !== undefined) return cachedClient;

  const calendarId = getCalendarId();
  const auth = resolveServiceAccountAuth();

  if (!calendarId || !auth) {
    if (!warnedAboutNoop) {
      console.warn(
        '[google-calendar] Operando em modo no-op. ' +
          'Defina GOOGLE_CALENDAR_ID e GOOGLE_SERVICE_ACCOUNT_KEY (ou GOOGLE_SERVICE_ACCOUNT_KEY_FILE) ' +
          'para habilitar a sincronização real com o Google Calendar.',
      );
      warnedAboutNoop = true;
    }
    cachedClient = null;
    return null;
  }

  cachedClient = google.calendar({ version: 'v3', auth: auth as never });
  return cachedClient;
}

/**
 * Reset do cache do client e do flag de warning. Apenas para uso em
 * testes — permite trocar variáveis de ambiente entre casos sem
 * reimportar o módulo.
 */
export function __resetGoogleCalendarClientForTests(): void {
  cachedClient = undefined;
  warnedAboutNoop = false;
}

/**
 * Indica se o módulo está em modo no-op no momento da chamada. Útil
 * para o caller decidir se deve atribuir `syncStatus='synced'`
 * imediatamente (no-op) ou se esperar resposta da API.
 */
export function isGoogleCalendarConfigured(): boolean {
  return getCalendarClient() !== null;
}

// ─── Retry inline (curto) ────────────────────────────────────────────

const INLINE_RETRY_DELAYS_MS = [200, 1000] as const;

/**
 * Executa `fn` com retry inline curto. Ver decisão "Retry inline"
 * no cabeçalho do módulo. Lança `GoogleCalendarError` após esgotar
 * as tentativas, preservando o erro original em `cause`.
 */
async function withInlineRetry<T>(
  operationLabel: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  // 1ª tentativa imediata + N retries com os delays acima.
  for (let attempt = 0; attempt <= INLINE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Erros 4xx (exceto 429 / 408) não são retriáveis: falha de
      // permissão, evento inexistente, payload inválido. Não adianta
      // insistir — propagamos imediatamente.
      const status = extractStatus(err);
      if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        break;
      }
      const delay = INLINE_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }

  const status = extractStatus(lastError);
  throw new GoogleCalendarError(
    `Falha ao executar "${operationLabel}" no Google Calendar.`,
    { cause: lastError, status },
  );
}

/** Pequena utilidade de sleep — extraída para que testes possam mockar. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrai um HTTP status do erro lançado pelo `googleapis` (que veste
 * o erro num shape `{ code: number, response?: { status } }`). Não
 * documentado oficialmente — fallback defensivo para `undefined`.
 */
function extractStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as { code?: unknown; response?: { status?: unknown } };
  if (typeof candidate.code === 'number') return candidate.code;
  if (typeof candidate.response?.status === 'number') return candidate.response.status;
  return undefined;
}

// ─── Operações públicas ──────────────────────────────────────────────

/**
 * Cria um evento no calendário compartilhado.
 *
 * - Modo live: retorna `{ googleEventId, mode: 'live' }`.
 * - Modo no-op: retorna `{ googleEventId: null, mode: 'noop' }`.
 * - Falha após retry: lança `GoogleCalendarError`.
 */
export async function createGoogleEvent(
  input: GoogleEventInput,
): Promise<CreateGoogleEventResult> {
  const client = getCalendarClient();
  if (!client) {
    return { googleEventId: null, mode: 'noop' };
  }
  const calendarId = getCalendarId() as string;

  const result = await withInlineRetry('createEvent', async () => {
    return client.events.insert({
      calendarId,
      requestBody: toGoogleRequestBody(input),
    });
  });

  const googleEventId = result.data?.id ?? null;
  if (!googleEventId) {
    // Resposta sem id é inesperada; tratamos como falha para o caller
    // tentar de novo no `retrySyncEvents`.
    throw new GoogleCalendarError('Google Calendar não retornou um id para o evento criado.');
  }
  return { googleEventId, mode: 'live' };
}

/**
 * Atualiza um evento existente. Em modo no-op, é uma função silenciosa
 * (resolve sem efeitos). Lança `GoogleCalendarError` na falha.
 */
export async function updateGoogleEvent(
  googleEventId: string,
  input: GoogleEventInput,
): Promise<void> {
  const client = getCalendarClient();
  if (!client) return;
  const calendarId = getCalendarId() as string;

  await withInlineRetry('updateEvent', async () => {
    return client.events.update({
      calendarId,
      eventId: googleEventId,
      requestBody: toGoogleRequestBody(input),
    });
  });
}

/**
 * Remove um evento. Em modo no-op, resolve silenciosamente. 404 do
 * Google (evento já removido) NÃO lança — é tratado como sucesso
 * idempotente, o estado final desejado já foi alcançado.
 */
export async function deleteGoogleEvent(googleEventId: string): Promise<void> {
  const client = getCalendarClient();
  if (!client) return;
  const calendarId = getCalendarId() as string;

  try {
    await withInlineRetry('deleteEvent', async () => {
      return client.events.delete({ calendarId, eventId: googleEventId });
    });
  } catch (err) {
    // 404 no delete = "já não existe". Mantemos a operação como sucesso.
    if (err instanceof GoogleCalendarError && err.status === 404) {
      return;
    }
    throw err;
  }
}

/**
 * Lista eventos numa janela de tempo `[start, end)`. Em modo no-op,
 * devolve `[]`. Falhas após retry lançam `GoogleCalendarError` —
 * o caller decide se exibe a página com fallback ou propaga 5xx.
 *
 * Usa `singleEvents=true` + `orderBy='startTime'` para que séries
 * recorrentes sejam expandidas em instâncias individuais (como
 * espera a UI mensal do Cronograma — Task 7.5).
 */
export async function listGoogleEvents(
  start: Date,
  end: Date,
): Promise<GoogleCalendarEvent[]> {
  const client = getCalendarClient();
  if (!client) return [];
  const calendarId = getCalendarId() as string;

  const result = await withInlineRetry('listEvents', async () => {
    return client.events.list({
      calendarId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
  });

  const items = result.data?.items ?? [];
  return items
    .map((item) => normalizeGoogleEvent(item))
    .filter((event): event is GoogleCalendarEvent => event !== null);
}

// ─── Helpers internos ────────────────────────────────────────────────

/**
 * Constrói o `requestBody` esperado pela Google Calendar API a partir
 * do payload interno. Mantemos `timeZone` ausente — a API interpreta
 * `dateTime` em ISO 8601 com offset (que é o que `Date#toISOString()`
 * produz: UTC com `Z`), evitando conflito com timezone do calendário.
 */
function toGoogleRequestBody(input: GoogleEventInput): calendar_v3.Schema$Event {
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
  };
}

/**
 * Converte um `Schema$Event` da Google API para o shape interno.
 * Eventos sem `dateTime` (eventos all-day usam `date`) ou sem id são
 * descartados — o módulo Cronograma trabalha com timestamps precisos
 * e ids, não com dias inteiros sem horário.
 */
function normalizeGoogleEvent(event: calendar_v3.Schema$Event): GoogleCalendarEvent | null {
  if (!event.id) return null;
  const startISO = event.start?.dateTime;
  const endISO = event.end?.dateTime;
  if (!startISO || !endISO) return null;

  return {
    googleEventId: event.id,
    title: event.summary ?? '(sem título)',
    startsAt: new Date(startISO),
    endsAt: new Date(endISO),
    description: event.description ?? null,
  };
}
