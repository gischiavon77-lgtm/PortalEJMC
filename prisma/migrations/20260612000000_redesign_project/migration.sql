-- Redesenho do modelo `Project` (commits 4154af3 e 8b74768, 2026-06-12).
--
-- Essa mudança foi aplicada na época com `prisma db push`, sem gerar
-- migração. Este arquivo registra a diferença entre a migração anterior
-- (`20260610231933_add_highlights`) e o `schema.prisma` atual.
--
-- O SQL é IDEMPOTENTE de propósito (IF EXISTS / IF NOT EXISTS): em bancos
-- que já receberam a mudança via `db push`, ele não faz nada; em bancos que
-- ainda estão no formato antigo, ele aplica o redesenho.
--
-- ATENÇÃO — perda de dados em bancos no formato antigo: as tabelas
-- `ProjectMember` e `ProjectStatusHistory` e as colunas `clientName`,
-- `description`, `startDate`, `endDate` e `status` de `Project` são removidas.

-- DropTable (as chaves estrangeiras das tabelas caem junto com elas)
DROP TABLE IF EXISTS "ProjectMember";

-- DropTable
DROP TABLE IF EXISTS "ProjectStatusHistory";

-- DropIndex
DROP INDEX IF EXISTS "Project_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Project_name_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "clientName",
DROP COLUMN IF EXISTS "description",
DROP COLUMN IF EXISTS "endDate",
DROP COLUMN IF EXISTS "startDate",
DROP COLUMN IF EXISTS "status",
ADD COLUMN IF NOT EXISTS "ferramenta" VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "proposalUrl" TEXT,
ADD COLUMN IF NOT EXISTS "team" TEXT NOT NULL DEFAULT '';

-- DropEnum (depois de remover a coluna `status`, que era a única a usá-lo)
DROP TYPE IF EXISTS "ProjectStatus";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_ferramenta_idx" ON "Project"("ferramenta");
