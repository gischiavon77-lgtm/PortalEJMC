import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ConfiguracoesShell } from '@/components/configuracoes/ConfiguracoesShell';
import type { ConfiguracoesUser } from '@/components/configuracoes/ConfiguracoesShell';

/**
 * `/configuracoes` — Página de Configurações (Task 18.4).
 *
 * Server Component que busca os dados do usuário autenticado e renderiza
 * o `ConfiguracoesShell` client-side com as seções:
 *   - Alterar Senha
 *   - Foto de Perfil
 *   - Administração (condicional: somente Admin)
 */

export const metadata: Metadata = {
  title: 'Configurações',
  description: 'Gerencie sua senha, foto de perfil e preferências.',
};

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let configUser: ConfiguracoesUser;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      redirect('/login');
    }

    configUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    console.error('[configuracoes] DB error:', err);
    // Fallback with session data
    configUser = {
      id: session.user.id,
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      role: session.user.role ?? 'MEMBRO',
      avatarUrl: null,
    };
  }

  return (
    <section
      aria-labelledby="configuracoes-heading"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">Conta</p>
        <h1
          id="configuracoes-heading"
          className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
        >
          Configurações
        </h1>
        <p className="text-text-secondary">
          Gerencie sua senha, foto de perfil e preferências do sistema.
        </p>
      </header>

      <ConfiguracoesShell user={configUser} />
    </section>
  );
}
