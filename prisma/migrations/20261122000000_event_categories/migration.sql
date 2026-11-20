-- Fase 4 da reforma: categoria nos eventos do calendario.
--
-- Cria o enum EventCategory e o campo Event.category. Eventos que ja
-- existiam ficam em "OUTROS" (decisao aprovada); eventos novos escolhem a
-- categoria no formulario. Nao remove nem altera outros dados.

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('INSTITUCIONAL', 'REUNIAO_AREA', 'PROJETOS_CLIENTES', 'COMERCIAL', 'CAPACITACAO', 'PROCESSO_SELETIVO', 'EVENTOS_INTEGRACAO', 'OUTROS');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "category" "EventCategory" NOT NULL DEFAULT 'OUTROS';

-- CreateIndex
CREATE INDEX "Event_category_idx" ON "Event"("category");

