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
 * Execução: `npx prisma db seed` (configurado em package.json `prisma.seed`).
 */

import { Area, InfractionType, KpiUnit, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@ejmc.com';
const DEFAULT_ADMIN_PASSWORD_FALLBACK = 'Admin@123';
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

async function seedAdminUser(): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD_FALLBACK;
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
  console.log('▶ Iniciando seed do Portal EJMC');

  await seedAdminUser();
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
    console.error('✗ Erro durante o seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
