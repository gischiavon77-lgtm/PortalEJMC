/**
 * Testes do serviço de email transacional — Task 3.10.
 *
 * Foco do teste:
 *   - Verificar que `sendAccountApprovedEmail` e `sendAccountRejectedEmail`
 *     delegam para `resend.emails.send` com:
 *       · `from` resolvido a partir de `EMAIL_FROM` (ou fallback).
 *       · `to` igual ao destinatário recebido.
 *       · `subject` em português conforme o requisito (Req 3.4 / 3.5).
 *       · `html` e `text` contendo o nome do usuário (personalização).
 *   - Verificar que, sem `RESEND_API_KEY`, o módulo opera em modo no-op
 *     (não lança, não cria client) e devolve `{ status: 'skipped' }`.
 *
 * Por que mockamos a Resend?
 *   Estamos validando o contrato entre o nosso wrapper e o SDK; não
 *   queremos disparar emails reais nem depender de rede. O mock
 *   substitui o construtor `Resend` por uma classe leve que registra os
 *   argumentos de `emails.send` para inspeção.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock do `resend` ─────────────────────────────────────────────────
// `vi.hoisted` garante que `sendMock` e a classe estejam disponíveis no
// momento em que o `vi.mock` é içado para o topo do arquivo (mocks são
// içados antes dos imports).
//
// Usamos uma `class` real (não `vi.fn(arrow)`) porque o módulo sob teste
// chama `new Resend(apiKey)` — uma arrow function não é constructable.
// Para inspecionar instâncias criadas, registramos cada construção em
// `instances`.
const { sendMock, FakeResend, instances } = vi.hoisted(() => {
  const sendMock = vi.fn();
  const instances: Array<{ apiKey: string }> = [];
  class FakeResend {
    public emails = { send: sendMock };
    constructor(public apiKey: string) {
      instances.push(this);
    }
  }
  return { sendMock, FakeResend, instances };
});

vi.mock('resend', () => ({
  Resend: FakeResend,
}));

// O import precisa vir DEPOIS do `vi.mock` para que o mock seja aplicado.
import {
  DEFAULT_FROM_ADDRESS,
  __resetEmailClientForTests,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} from '@/lib/email';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
  // Por padrão a Resend retorna `{ data: { id }, error: null }`.
  sendMock.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });
  // Limpa o registro de instâncias do client criadas em testes anteriores.
  instances.length = 0;
  // Reset do cache lazy do client para que mudanças em RESEND_API_KEY
  // entre testes sejam observadas.
  __resetEmailClientForTests();
  // Limpa variáveis controladas pelos testes; cada caso seta o que precisa.
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  // Restaura o ambiente original para não vazar entre arquivos de teste.
  process.env = { ...ORIGINAL_ENV };
});

describe('sendAccountApprovedEmail', () => {
  it('chama resend.emails.send com assunto, destinatário e nome do usuário (Req 3.4)', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    const result = await sendAccountApprovedEmail({
      to: 'ana@ejmc.com.br',
      name: 'Ana Maria',
    });

    expect(result).toEqual({ status: 'sent', id: 'email-id-123' });
    expect(sendMock).toHaveBeenCalledTimes(1);

    const payload = sendMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      from: DEFAULT_FROM_ADDRESS,
      to: 'ana@ejmc.com.br',
      subject: 'Sua conta no Portal EJMC foi aprovada',
    });
    expect(payload.html).toContain('Ana Maria');
    expect(payload.text).toContain('Ana Maria');
  });

  it('respeita EMAIL_FROM quando a variável está definida', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'EJMC Sandbox <sandbox@example.com>';

    await sendAccountApprovedEmail({ to: 'ana@ejmc.com.br', name: 'Ana' });

    expect(sendMock.mock.calls[0][0]).toMatchObject({
      from: 'EJMC Sandbox <sandbox@example.com>',
    });
  });
});

describe('sendAccountRejectedEmail', () => {
  it('chama resend.emails.send com assunto e nome corretos (Req 3.5)', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    const result = await sendAccountRejectedEmail({
      to: 'bruno@ejmc.com.br',
      name: 'Bruno Silva',
    });

    expect(result).toEqual({ status: 'sent', id: 'email-id-123' });
    expect(sendMock).toHaveBeenCalledTimes(1);

    const payload = sendMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      from: DEFAULT_FROM_ADDRESS,
      to: 'bruno@ejmc.com.br',
      subject: 'Sua solicitação de cadastro foi recusada',
    });
    expect(payload.html).toContain('Bruno Silva');
    expect(payload.text).toContain('Bruno Silva');
  });

  it('escapa HTML em nomes contendo caracteres especiais para evitar quebra do template', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    await sendAccountRejectedEmail({
      to: 'x@y.com',
      // Nome teoricamente improvável, mas defensivo: garante que `<` e `>`
      // são escapados no HTML (mas o `text` plano segue cru, por design).
      name: 'Carlos <script>',
    });

    const payload = sendMock.mock.calls[0][0];
    expect(payload.html).toContain('Carlos &lt;script&gt;');
    expect(payload.html).not.toContain('<script>');
  });
});

describe('comportamento sem RESEND_API_KEY', () => {
  it('não instancia o client e devolve status=skipped quando a chave está ausente', async () => {
    // RESEND_API_KEY já foi removida no beforeEach.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendAccountApprovedEmail({
      to: 'ana@ejmc.com.br',
      name: 'Ana',
    });

    expect(result).toEqual({ status: 'skipped', reason: 'missing-api-key' });
    expect(sendMock).not.toHaveBeenCalled();
    expect(instances).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
