'use client';

/**
 * SessionExpiredWatcher — componente "headless" que observa a sessão e
 * dispara o redirecionamento para `/login?error=SessionExpired` quando
 * o token JWT expira mid-navegação (Task 4.6 / Req 1.3).
 *
 * Por que um componente, e não chamar o hook diretamente em cada página?
 *   Centralizar a observação em um único componente, montado pelo
 *   `SessionProvider`, garante que **toda** rota autenticada herde o
 *   comportamento sem alteração — caso contrário, esquecer de chamar
 *   o hook em uma página recém-criada criaria um buraco de UX (a
 *   página deixaria de redirecionar mid-sessão).
 *
 *   Para uso em testes ou em layouts que queiram opt-in fora do
 *   `SessionProvider`, basta importar e renderizar `<SessionExpiredWatcher />`.
 *
 * Por que renderizar `null`?
 *   O componente é puramente um portador do `useEffect` do hook. Não
 *   produz UI; deixar isso explícito ajuda a entender que sua única
 *   responsabilidade é o side-effect de redirecionamento.
 */

import { useSessionExpiredRedirect } from '@/hooks/useSessionExpiredRedirect';

export function SessionExpiredWatcher(): null {
  useSessionExpiredRedirect();
  return null;
}
