/**
 * `POST /api/auth/register` — Auto-cadastro de novos membros.
 *
 * Tasks 3.6 e 3.7:
 *   - Valida o body com `registerSchema` (Zod) — nome 3-150, email RFC
 *     5322-ish, senha 8-128 com maiúscula/minúscula/número.
 *   - Verifica unicidade de email (Property 5 / Req 3.2). Devolve 409
 *     com `code: 'EMAIL_TAKEN'` quando já existe uma conta com aquele
 *     email — independentemente do status (ACTIVE/PENDING/INACTIVE/
 *     REJECTED), pois reaproveitar email é proibido pelo Req 3.2.
 *   - Faz hash da senha com bcrypt (10 rounds, mesmo custo aplicado em
 *     todo o sistema) antes de gravar.
 *   - Cria o usuário com `status = PENDING` e `role = MEMBRO` (Req 3.1,
 *     3.4 — a aprovação por administrador é tratada na Task 19).
 *   - Retorna 201 com `{ id, email, status }`. Nunca devolve
 *     `passwordHash` ou outros campos sensíveis.
 *
 * ─── Sobre o code 'EMAIL_TAKEN' e a Property 1 ────────────────────────
 *   O Req 3.2 exige a mensagem clara "email já em uso" no fluxo de
 *   cadastro — diferente do login (Req 1.2 / Property 1) onde a mensagem
 *   precisa ser indistinguível para impedir enumeração de contas.
 *
 *   Em cadastro, qualquer atacante poderia descobrir emails existentes
 *   simplesmente tentando criar contas: como o sistema PRECISA aceitar
 *   apenas um cadastro por email, a resposta sempre revelará isso de
 *   alguma forma (por timing, ID retornado, etc.). Optar pela mensagem
 *   explícita não piora a postura de segurança e ajuda usuários
 *   legítimos. A defesa contra enumeração massiva fica a cargo de rate
 *   limiting na borda (CDN/WAF) e da Task 4.x para limitar IPs com
 *   tentativas excessivas.
 *
 * ─── Formato de erros (consistente com o design.md) ───────────────────
 *   - Body inválido (não-JSON ou ausente):
 *       400 { error: true, code: 'INVALID_JSON', message: '...' }
 *   - Validação Zod falhou:
 *       400 { error: true, code: 'VALIDATION_ERROR',
 *             fields: [{ path, message }, ...] }
 *   - Email já cadastrado:
 *       409 { error: true, code: 'EMAIL_TAKEN', message: '...' }
 *   - Erro inesperado (DB, etc.):
 *       500 { error: true, code: 'INTERNAL_ERROR', message: '...' }
 *
 * ─── Sucesso ──────────────────────────────────────────────────────────
 *   201 { id, email, status }
 *   - Status sempre `PENDING` neste endpoint (auto-cadastro).
 *   - O email retornado já é a versão normalizada (lowercase) gravada
 *     no banco — o cliente pode confiar nesse valor para futuras
 *     tentativas de login.
 *
 * Runtime: Node.js (forçado via `export const runtime = 'nodejs'`)
 *   `bcryptjs` funciona em Edge, mas o adapter do Prisma 7 + `pg`
 *   exige Node. Como esta rota usa Prisma, mantemos consistência com o
 *   restante das API Routes do portal e pinamos o runtime.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators/auth';

/** Custo do bcrypt aplicado a todas as senhas do sistema. */
const BCRYPT_COST = 10;

/** Garante runtime Node (Prisma + adapter `pg` não rodam em Edge). */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  // ─── 1. Parse do JSON ──────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_JSON',
        message: 'Corpo da requisição inválido. Esperado JSON válido.',
      },
      { status: 400 },
    );
  }

  // ─── 2. Validação Zod ──────────────────────────────────────────────
  let payload;
  try {
    payload = registerSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados de cadastro inválidos.',
          fields: err.issues.map((issue) => ({
            // `path` pode estar vazio se o input for `undefined` no root;
            // nesse caso devolvemos string vazia para o cliente conseguir
            // identificar que o erro é no body, não em um campo específico.
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const { name, email, password } = payload;

  // ─── 3. Verificação de unicidade — Property 5 / Req 3.2 ────────────
  // A consulta abaixo serve como pré-checagem amigável (mensagem
  // imediata, sem custo de bcrypt). Mesmo assim, mantemos o tratamento
  // de `P2002` no `create` adiante para fechar a janela de corrida
  // (dois cadastros simultâneos para o mesmo email).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: true,
        code: 'EMAIL_TAKEN',
        message: 'Este email já está em uso.',
      },
      { status: 409 },
    );
  }

  // ─── 4. Hash da senha + criação do usuário ────────────────────────
  // bcrypt antes do `create` para que, em caso de falha de hash, não
  // criemos um registro sem `passwordHash`.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        // Auto-cadastro sempre nasce PENDING e MEMBRO.
        // Aprovação/elevação são feitas pelo Admin (Task 19).
        status: 'PENDING',
        role: 'MEMBRO',
      },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    // Janela de corrida: P2002 (unique constraint) significa que outro
    // request inseriu o mesmo email entre o `findUnique` e o `create`.
    // Mapeamos para a mesma resposta 409 do caminho amigável acima.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        {
          error: true,
          code: 'EMAIL_TAKEN',
          message: 'Este email já está em uso.',
        },
        { status: 409 },
      );
    }

    // Logamos no servidor para auditoria, mas devolvemos uma mensagem
    // genérica para não vazar detalhes de infraestrutura.
    console.error('[auth/register] Falha ao criar usuário:', err);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir o cadastro. Tente novamente.',
      },
      { status: 500 },
    );
  }
}
