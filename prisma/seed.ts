/**
 * Prisma seed — Portal Interno EJMC
 *
 * Task 2.9: Popula o banco com dados iniciais de forma idempotente.
 *
 * O que é semeado:
 *   1) Administrador padrão (upsert por email).
 *   2) KPIs pré-definidos por área (Requisito 10.5):
 *        Inadimplência (PERCENTAGE, ADM_FIN)
 *        Capacidade Produtiva (PERCENTAGE, PROJETOS)
 *        Congelamentos (INTEGER, PROJETOS)
 *        NPS (DECIMAL, VENDAS)
 *        CSAT (DECIMAL, VENDAS)
 *   3) Configuração de pontos por tipo de infração (InfractionConfig).
 *
 * Sobre os 7 computadores: o design modela computadores como
 * `computerId Int (1..7)` diretamente em `Reservation`, sem tabela
 * separada para computadores (ver `prisma/schema.prisma`). Portanto
 * não há linhas a serem criadas para computadores — os IDs 1..7 são
 * implícitos e validados na camada de aplicação (Task 17).
 *
 * Idempotência: todas as operações usam `upsert` (ou findFirst+create)
 * para que executar o seed múltiplas vezes não duplique dados.
 *
 * Senha do administrador: vem OBRIGATORIAMENTE da variável de ambiente
 * `SEED_ADMIN_PASSWORD`. Não existe senha padrão no código — sem a
 * variável, o seed para antes de tocar no banco. A senha só é usada na
 * CRIAÇÃO do admin; se ele já existir, a senha atual é mantida.
 *
 * Execução: `npx prisma db seed` (configurado em package.json `prisma.seed`).
 */

import { Area, InfractionType, KpiUnit, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ADMIN_EMAIL = 'admin@ejmc.com';
const ADMIN_PASSWORD_ENV = 'SEED_ADMIN_PASSWORD';
const ADMIN_PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

type KpiSeed = {
  name: string;
  unit: KpiUnit;
  area: Area | null;
};

const KPI_SEEDS: KpiSeed[] = [
  { name: 'Inadimplência', unit: KpiUnit.PERCENTAGE, area: Area.ADM_FIN },
  { name: 'Capacidade Produtiva', unit: KpiUnit.PERCENTAGE, area: Area.PROJETOS },
  { name: 'Congelamentos', unit: KpiUnit.INTEGER, area: Area.PROJETOS },
  { name: 'NPS', unit: KpiUnit.DECIMAL, area: Area.VENDAS },
  { name: 'CSAT', unit: KpiUnit.DECIMAL, area: Area.VENDAS },
];

const INFRACTION_POINTS: Record<InfractionType, number> = {
  [InfractionType.ATRASO]: 1,
  [InfractionType.FALTA]: 3,
  [InfractionType.DRESS_CODE]: 1,
};

/**
 * Lê a senha do admin de `SEED_ADMIN_PASSWORD`. Lança erro com instrução
 * clara se a variável não existir, estiver vazia ou for curta demais.
 * Chamada no início de `main`, antes de qualquer escrita no banco.
 */
function requireAdminPassword(): string {
  const password = process.env[ADMIN_PASSWORD_ENV];

  if (!password || password.trim() === '') {
    throw new Error(
      [
        `A variável de ambiente ${ADMIN_PASSWORD_ENV} não está definida.`,
        'O seed não tem senha padrão: defina a senha do administrador antes de rodar.',
        `  PowerShell: $env:${ADMIN_PASSWORD_ENV}="uma-senha-forte"; npx prisma db seed`,
        `  bash:       ${ADMIN_PASSWORD_ENV}="uma-senha-forte" npx prisma db seed`,
      ].join('\n'),
    );
  }

  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `${ADMIN_PASSWORD_ENV} deve ter pelo menos ${ADMIN_PASSWORD_MIN_LENGTH} caracteres.`,
    );
  }

  return password;
}

async function seedAdminUser(password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      // Mantemos o admin existente intacto se já houver; só garantimos o status/role.
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    },
    create: {
      name: 'Administrador EJMC',
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      area: Area.PRESIDENCIA,
      position: 'Administrador do Sistema',
    },
  });

  console.log(`✓ Admin pronto: ${admin.email} (id=${admin.id})`);
}

async function seedKpis(): Promise<void> {
  for (const kpi of KPI_SEEDS) {
    // O schema atual não possui @@unique([name, area]) em Kpi, então fazemos
    // upsert manual via findFirst + create para manter idempotência.
    const existing = await prisma.kpi.findFirst({
      where: { name: kpi.name, area: kpi.area },
      select: { id: true },
    });

    if (existing) {
      await prisma.kpi.update({
        where: { id: existing.id },
        data: { unit: kpi.unit },
      });
      console.log(`✓ KPI já existia, atualizado: ${kpi.name} (${kpi.area ?? 'GLOBAL'})`);
    } else {
      const created = await prisma.kpi.create({
        data: {
          name: kpi.name,
          unit: kpi.unit,
          area: kpi.area,
        },
        select: { id: true },
      });
      console.log(`✓ KPI criado: ${kpi.name} (${kpi.area ?? 'GLOBAL'}) id=${created.id}`);
    }
  }
}

async function seedInfractionConfig(): Promise<void> {
  for (const type of Object.values(InfractionType)) {
    const points = INFRACTION_POINTS[type];
    const config = await prisma.infractionConfig.upsert({
      where: { type },
      update: { points },
      create: { type, points },
    });
    console.log(`✓ InfractionConfig: ${config.type} = ${config.points} ponto(s)`);
  }
}

async function main(): Promise<void> {
  // Valida a senha ANTES de qualquer escrita: se faltar, nada é semeado.
  const adminPassword = requireAdminPassword();

  console.log('▶ Iniciando seed do Portal EJMC');

  await seedAdminUser(adminPassword);
  await seedKpis();
  await seedInfractionConfig();

  console.log(
    'ℹ Computadores não são semeados: o schema usa computerId Int (1..7) ' +
      'diretamente em Reservation, sem tabela separada.',
  );
  console.log('✓ Seed concluído com sucesso');
}

main()
  .catch((error) => {
    console.error('✗ Erro durante o seed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
