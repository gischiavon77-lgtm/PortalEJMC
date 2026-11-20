import { redirect } from 'next/navigation';

/**
 * `/membros` — endereço antigo do álbum de figurinhas.
 *
 * A tela foi substituída pela Estrutura na Fase 5 da reforma; quem chega
 * por um link salvo é levado para `/estrutura`.
 */

export default function MembrosPage(): never {
  redirect('/estrutura');
}
