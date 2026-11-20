-- Fase 5 da reforma: a tela de membros/álbum foi substituída pela
-- "Estrutura", gerada a partir dos usuários ativos. O álbum de figurinhas
-- por gestão deixa de existir, junto com a tabela "AlbumMember".
--
-- ATENÇÃO: apaga os registros do álbum. Fotos que estejam no bucket de
-- imagens, na pasta album/, não são removidas por esta migração.

-- DropTable
DROP TABLE "AlbumMember";
