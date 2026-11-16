-- Arquivos saem do banco e vão para o Supabase Storage.
--
-- Avatares, fotos do álbum, fotos de destaques e PDFs de proposta eram
-- gravados em base64 nestas colunas. Agora o arquivo fica no Storage e o
-- banco guarda apenas o caminho dele no bucket.
--
-- ATENÇÃO — as colunas antigas são REMOVIDAS, junto com o conteúdo em
-- base64 que houver nelas. Não há conversão automática dos arquivos
-- antigos: a mudança foi feita sem dados reais a migrar.

-- AlterTable
ALTER TABLE "AlbumMember" DROP COLUMN "photoUrl",
ADD COLUMN     "photoPath" VARCHAR(300);

-- AlterTable
ALTER TABLE "Highlight" DROP COLUMN "photoUrl",
ADD COLUMN     "photoPath" VARCHAR(300);

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "proposalUrl",
ADD COLUMN     "proposalPath" VARCHAR(300);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
ADD COLUMN     "avatarPath" VARCHAR(300);
