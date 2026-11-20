/**
 * URLs internas dos arquivos guardados no Storage.
 *
 * O banco guarda só o caminho do arquivo no bucket (`avatarPath`,
 * `photoPath`, `proposalPath`). Para exibir, as telas recebem uma URL
 * das rotas de download do próprio portal — que conferem o login antes
 * de repassar o arquivo. O caminho do bucket nunca vai ao navegador.
 *
 * O parâmetro `v` (derivado do nome do arquivo, que é um UUID novo a
 * cada upload) serve só para o navegador não reutilizar a imagem antiga
 * do cache quando a foto é trocada.
 *
 * Módulo puro: pode ser usado em Server e Client Components.
 */

export type ImageKind = 'avatar' | 'album' | 'destaque' | 'post';

function versionOf(path: string): string {
  const fileName = path.split('/').pop() ?? '';
  return fileName.split('.')[0].slice(0, 12);
}

function imageUrl(kind: ImageKind, id: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/files/${kind}/${encodeURIComponent(id)}?v=${versionOf(path)}`;
}

/** URL do avatar de um usuário, ou `null` se ele não tem foto. */
export function avatarUrlFor(userId: string, avatarPath: string | null | undefined): string | null {
  return imageUrl('avatar', userId, avatarPath);
}

/** URL da foto de um membro do álbum, ou `null`. */
export function albumPhotoUrlFor(
  memberId: string,
  photoPath: string | null | undefined,
): string | null {
  return imageUrl('album', memberId, photoPath);
}

/** URL da foto de um destaque (identificado pelo slot), ou `null`. */
export function highlightPhotoUrlFor(
  slot: string,
  photoPath: string | null | undefined,
): string | null {
  return imageUrl('destaque', slot, photoPath);
}

/** URL da imagem de uma publicação do feed, ou `null` se ela não tem imagem. */
export function postImageUrlFor(
  postId: string,
  imagePath: string | null | undefined,
): string | null {
  return imageUrl('post', postId, imagePath);
}

/** URL de download da proposta (PDF) de um projeto. */
export function proposalUrlFor(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/proposal`;
}
