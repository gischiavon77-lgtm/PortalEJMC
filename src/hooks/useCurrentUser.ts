'use client';

/**
 * `useCurrentUser` — Carrega os dados de perfil do usuário autenticado.
 *
 * O JWT/sessão do portal é deliberadamente mínimo (`id`, `role`, `area`,
 * `status`) para manter o cookie pequeno e evitar o erro 494 na Vercel
 * — por isso `name`, `position` (cargo) e `avatarUrl` (base64) NÃO ficam
 * na sessão. Este hook busca esses campos sob demanda em
 * `GET /api/users/me`.
 *
 * Atualização em tempo real: ao salvar uma nova foto/perfil em
 * Configurações, dispare `window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))`
 * para que todas as instâncias do hook (sidebar, topbar) recarreguem.
 */

import { useCallback, useEffect, useState } from 'react';

export const PROFILE_UPDATED_EVENT = 'ejmc:profile-updated';

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  area: string | null;
  position: string | null;
  avatarUrl: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { user?: CurrentUser };
        if (data.user) setUser(data.user);
      }
    } catch {
      // Falha silenciosa — mantém o estado anterior.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    function onUpdate() {
      fetchUser();
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
  }, [fetchUser]);

  return { user, loading, refresh: fetchUser };
}
