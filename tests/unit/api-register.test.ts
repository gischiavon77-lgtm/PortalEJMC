/**
 * Testes do handler `POST /api/auth/register` — Task 3.7.
 *
 * Foco: verificar que a unicidade de email (Property 5 / Req 3.2) é
 * aplicada corretamente, tanto no pré-check quanto no tratamento da
 * janela de corrida (P2002), incluindo a normalização case-insensitive
 * realizada pelo `registerSchema`.
 *
 * Por que mockamos o `prisma`?
 *   O objetivo aqui é exercitar a lógica do handler isoladamente, sem
 *   subir banco. A camada de validação (Zod) e a integração com Prisma
 *   ficam cobertas indiretamente: o teste injeta respostas controladas
 *   em `findUnique`/`create` e verifica que o handler converte cada
 *   caso na resposta HTTP esperada.
 *
 * Por que mockamos `Prisma.PrismaClientKnownRequestError`?
 *   Em ambiente de teste, importar `@prisma/client` pode falhar se o
 *   client não estiver gerado (`prisma generate`). Subimos um stub
 *   leve com a mesma forma usada pelo handler (`code === 'P2002'`).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Mock do `@prisma/client` (Prisma + tipos enxutos) ────────────────
// O handler só usa `Prisma.PrismaClientKnownRequestError` para o
// `instanceof` no catch. Fornecemos uma classe equivalente para que
// `err instanceof Prisma.PrismaClientKnownRequestError` retorne `true`
// quando lançarmos a versão mockada.
//
// Usamos `vi.hoisted` porque `vi.mock` é içado para o topo do arquivo;
// referências a variáveis declaradas fora deste bloco causariam
// `ReferenceError` durante a resolução do mock.
const { MockedPrismaClientKnownRequestError } = vi.hoisted(() => {
  class MockedPrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return { MockedPrismaClientKnownRequestError };
});

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockedPrismaClientKnownRequestError,
  },
}));

// ─── Mock do singleton do Prisma usado pelo handler ───────────────────
const { findUniqueMock, createMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

// O import do handler precisa vir DEPOIS dos `vi.mock` para que os mocks
// sejam aplicados na resolução do módulo.
import { POST } from '@/app/api/auth/register/route';

const validBody = {
  name: 'Ana Maria',
  email: 'ana@ejmc.com.br',
  password: 'Senha123',
};

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  findUniqueMock.mockReset();
  createMock.mockReset();
});

describe('POST /api/auth/register — unicidade de email', () => {
  it('retorna 409 EMAIL_TAKEN quando o email já está cadastrado (pré-check)', async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 'existing-user-id' });

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: true,
      code: 'EMAIL_TAKEN',
    });
    // O pré-check evita custo desnecessário de bcrypt/create.
    expect(createMock).not.toHaveBeenCalled();
  });

  it('compara emails de forma case-insensitive (normaliza para lowercase antes do findUnique)', async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 'existing-user-id' });

    const response = await POST(
      buildRequest({ ...validBody, email: '  Foo@Bar.COM  ' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe('EMAIL_TAKEN');
    // Confirma que o handler delega ao Prisma já com o email normalizado.
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: 'foo@bar.com' },
      select: { id: true },
    });
  });

  it('retorna 409 EMAIL_TAKEN quando o pré-check passa mas o create estoura P2002 (race condition)', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockRejectedValueOnce(
      new MockedPrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        'P2002',
      ),
    );

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: true,
      code: 'EMAIL_TAKEN',
    });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('retorna 201 quando o email não existe e o create é bem-sucedido', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValueOnce({
      id: 'new-user-id',
      email: 'ana@ejmc.com.br',
      status: 'PENDING',
    });

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      id: 'new-user-id',
      email: 'ana@ejmc.com.br',
      status: 'PENDING',
    });
  });
});
