-- Fase 3 da reforma: projetos no estilo "Radar".
--
-- Project ganha descrição, status (em andamento / concluído) e banner.
-- A equipe deixa de ser texto livre e passa a ser o vínculo ProjectMember
-- com usuários cadastrados. O progresso (0-100%) sai: o status o substitui.
--
-- ATENÇÃO — as colunas "team" e "progress" são REMOVIDAS. Projetos com
-- progresso 100% viram "CONCLUIDO" antes da remoção. Os nomes da equipe
-- em texto não são convertidos (decisão aprovada: não havia projetos
-- cadastrados quando a mudança foi feita).

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO');

-- AlterTable: colunas novas
ALTER TABLE "Project"
ADD COLUMN     "bannerPath" VARCHAR(300),
ADD COLUMN     "description" VARCHAR(2000) NOT NULL DEFAULT '',
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'EM_ANDAMENTO';

-- Conversão: progresso 100% vira "concluído"
UPDATE "Project" SET "status" = 'CONCLUIDO' WHERE "progress" >= 100;

-- AlterTable: colunas que saem
ALTER TABLE "Project" DROP COLUMN "progress",
DROP COLUMN "team";

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
