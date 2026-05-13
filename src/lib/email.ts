/**
 * Serviço de email transacional — Task 3.10.
 *
 * Wrapper fino sobre o cliente Resend (https://resend.com) usado para
 * notificar usuários nos seguintes cenários:
 *   - Conta de cadastro aprovada por um Administrador (Req 3.4).
 *   - Conta de cadastro rejeitada por um Administrador (Req 3.5).
 *
 * Ambos os requisitos exigem o disparo do email em até 5 minutos após
 * a decisão; o envio é fire-and-forget no contexto da Task 3.10 — a
 * Task 19.3 fará o wiring a partir dos endpoints de admin.
 *
 * ─── Decisões de design ──────────────────────────────────────────────
 *
 * 1. **Inicialização lazy do client.** A instância de `Resend` só é
 *    criada na primeira chamada que precisa dela. Isso evita penalizar
 *    o tempo de boot do servidor e facilita ambientes onde a chave não
 *    está configurada (testes locais, dev sem credenciais).
 *
 * 2. **Sem chave → no-op com warning.** Em desenvolvimento é comum não
 *    ter `RESEND_API_KEY` configurado. Em vez de lançar e quebrar fluxos
 *    administrativos (aprovar/rejeitar conta), registramos um warning
 *    informativo e seguimos sem enviar o email. A operação principal
 *    (mudança de status no banco) não pode ser bloqueada por uma
 *    integração externa indisponível em dev.
 *
 *    Em produção a chave precisa estar definida — esse contrato é
 *    documentado em `.env.local.example` e validado em deploy via
 *    convenção de operação, não em runtime, para manter este módulo
 *    simples e testável.
 *
 * 3. **From-address configurável.** Lemos `EMAIL_FROM` do ambiente com
 *    fallback para `'EJMC Portal <no-reply@ejmc.com.br>'`. Isso permite
 *    trocar o remetente sem alterar código (ex.: usar um domínio
 *    sandbox da Resend antes de verificar o domínio oficial).
 *
 * 4. **Templates HTML inline e curtos.** Não introduzimos um motor de
 *    templates (MJML/React Email) por enquanto; basta um HTML simples
 *    em português com o nome do destinatário. Mantemos também um
 *    `text/plain` com o mesmo conteúdo para clientes que não renderizam
 *    HTML (boa prática anti-spam).
 *
 * 5. **Erros não derrubam o caller.** O wrapper captura exceções da
 *    Resend e as registra via `console.error`. Reenvio/observabilidade
 *    mais sofisticados ficam para uma evolução futura — aqui o foco é
 *    não ter uma falha de email derrubar a aprovação/rejeição.
 *
 * Este módulo NÃO é importado pelos endpoints de admin nesta task —
 * o wiring acontece na Task 19.3. Aqui apenas expomos a API.
 */

import { Resend } from 'resend';

/**
 * From-address padrão usado quando `EMAIL_FROM` não está definido.
 * Mantido como constante exportada para que os testes possam validar
 * o valor sem duplicar o literal.
 */
export const DEFAULT_FROM_ADDRESS = 'EJMC Portal <no-reply@ejmc.com.br>';

/**
 * Resultado padronizado das funções de envio. Permite ao caller
 * distinguir entre envio real (`sent`), no-op por configuração ausente
 * (`skipped`) e falha (`failed`) sem ter de inspecionar o objeto cru
 * da Resend.
 */
export type SendEmailResult =
  | { status: 'sent'; id: string | null }
  | { status: 'skipped'; reason: 'missing-api-key' }
  | { status: 'failed'; error: unknown };

interface SendAccountStatusEmailParams {
  /** Endereço do destinatário (email cadastrado do usuário). */
  to: string;
  /** Nome do usuário, usado para personalizar a saudação. */
  name: string;
}

// ─── Estado interno: lazy singleton do client Resend ──────────────────
// Mantemos a instância em escopo de módulo para que múltiplas chamadas
// reaproveitem a mesma conexão HTTP keep-alive subjacente. `undefined`
// significa "ainda não tentamos resolver"; `null` significa "tentamos e
// não havia chave" — armazenar o `null` evita reler o `process.env` e
// reemitir o warning em cada chamada subsequente.
let cachedClient: Resend | null | undefined;

/**
 * Resolve a instância de Resend de forma lazy. Retorna `null` quando
 * `RESEND_API_KEY` não está configurado (logando um warning único por
 * processo), permitindo aos callers operar em modo no-op sem precisar
 * checar variáveis de ambiente diretamente.
 *
 * Exportado para uso em testes que queiram resetar o cache (ver
 * `__resetEmailClientForTests`).
 */
function getResend(): Resend | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Warning único por processo. Em produção esse caminho indica
    // configuração incompleta; em dev é o comportamento esperado.
    console.warn(
      '[email] RESEND_API_KEY ausente — emails transacionais serão ignorados. ' +
        'Defina RESEND_API_KEY em .env.local para habilitar o envio.',
    );
    cachedClient = null;
    return null;
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/**
 * Reset do cache do client. Apenas para uso em testes — permite trocar
 * a variável de ambiente entre casos sem reimportar o módulo.
 */
export function __resetEmailClientForTests(): void {
  cachedClient = undefined;
}

/**
 * Resolve o endereço de remetente lendo `EMAIL_FROM` do ambiente, com
 * fallback para `DEFAULT_FROM_ADDRESS`. Mantido como função (não
 * constante) para que mudanças em `process.env` durante testes sejam
 * refletidas a cada chamada.
 */
function resolveFromAddress(): string {
  const fromEnv = process.env.EMAIL_FROM;
  return fromEnv && fromEnv.trim() ? fromEnv : DEFAULT_FROM_ADDRESS;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Helper interno: dispara o email via Resend, tratando os 3 caminhos
 * (sucesso, sem-chave, erro). Não é exportado porque os callers devem
 * usar as funções específicas (`sendAccountApprovedEmail` /
 * `sendAccountRejectedEmail`) que encapsulam o conteúdo do template.
 */
async function send({ to, subject, html, text }: SendArgs): Promise<SendEmailResult> {
  const client = getResend();
  if (!client) {
    return { status: 'skipped', reason: 'missing-api-key' };
  }

  try {
    const response = await client.emails.send({
      from: resolveFromAddress(),
      to,
      subject,
      html,
      text,
    });

    // A Resend retorna `{ data, error }`; tratamos `error` como falha
    // sem lançar para o caller — o resultado já carrega o detalhe.
    if (response.error) {
      console.error('[email] Falha ao enviar email via Resend:', response.error);
      return { status: 'failed', error: response.error };
    }

    return { status: 'sent', id: response.data?.id ?? null };
  } catch (error) {
    // Erros de rede ou exceções não previstas. Logamos para
    // observabilidade e devolvemos `failed` para o caller decidir o
    // que fazer (no fluxo atual, a aprovação/rejeição já foi efetivada
    // no banco, então a falha de email é apenas um aviso).
    console.error('[email] Exceção inesperada ao enviar email:', error);
    return { status: 'failed', error };
  }
}

/**
 * Notifica o usuário que sua conta no Portal EJMC foi aprovada por um
 * Administrador (Req 3.4). O email contém uma saudação personalizada e
 * orienta o acesso ao Portal.
 */
export async function sendAccountApprovedEmail({
  to,
  name,
}: SendAccountStatusEmailParams): Promise<SendEmailResult> {
  const subject = 'Sua conta no Portal EJMC foi aprovada';
  const greetingName = (name ?? '').trim() || 'membro EJMC';

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="font-family: 'DM Sans', Arial, sans-serif; color: #1a0a0d; line-height: 1.5;">
    <p>Olá, ${escapeHtml(greetingName)}!</p>
    <p>Sua conta no <strong>Portal Interno EJMC</strong> foi aprovada.</p>
    <p>Você já pode acessar o Portal com o email cadastrado e começar a usar os módulos disponíveis para o seu perfil.</p>
    <p>Bem-vindo(a) ao time!</p>
    <p style="color: #5c3a3f; font-size: 12px; margin-top: 32px;">EJMC — Empresa Júnior Mackenzie Consultoria</p>
  </body>
</html>`;

  const text =
    `Olá, ${greetingName}!\n\n` +
    'Sua conta no Portal Interno EJMC foi aprovada.\n\n' +
    'Você já pode acessar o Portal com o email cadastrado e começar a usar os módulos disponíveis para o seu perfil.\n\n' +
    'Bem-vindo(a) ao time!\n\n' +
    '— EJMC — Empresa Júnior Mackenzie Consultoria';

  return send({ to, subject, html, text });
}

/**
 * Notifica o usuário que sua solicitação de cadastro foi recusada
 * (Req 3.5). Mantemos a mensagem curta e neutra — não revelamos o
 * motivo da rejeição por padrão; ajustes ficam para evolução futura
 * caso o admin precise enviar uma justificativa específica.
 */
export async function sendAccountRejectedEmail({
  to,
  name,
}: SendAccountStatusEmailParams): Promise<SendEmailResult> {
  const subject = 'Sua solicitação de cadastro foi recusada';
  const greetingName = (name ?? '').trim() || 'visitante';

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="font-family: 'DM Sans', Arial, sans-serif; color: #1a0a0d; line-height: 1.5;">
    <p>Olá, ${escapeHtml(greetingName)}.</p>
    <p>Recebemos sua solicitação de cadastro no <strong>Portal Interno EJMC</strong>, mas não foi possível aprová-la neste momento.</p>
    <p>Se acredita que houve um engano, entre em contato com a diretoria da EJMC para mais informações.</p>
    <p style="color: #5c3a3f; font-size: 12px; margin-top: 32px;">EJMC — Empresa Júnior Mackenzie Consultoria</p>
  </body>
</html>`;

  const text =
    `Olá, ${greetingName}.\n\n` +
    'Recebemos sua solicitação de cadastro no Portal Interno EJMC, mas não foi possível aprová-la neste momento.\n\n' +
    'Se acredita que houve um engano, entre em contato com a diretoria da EJMC para mais informações.\n\n' +
    '— EJMC — Empresa Júnior Mackenzie Consultoria';

  return send({ to, subject, html, text });
}

/**
 * Escape mínimo para os campos interpolados no HTML (apenas o nome do
 * usuário hoje). Evita que caracteres como `<`, `>` e `&` quebrem o
 * template ou abram vetor de injeção, mesmo que a entrada já tenha
 * passado por validação Zod no cadastro.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
