import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProfileForm } from '@/components/perfil/ProfileForm';
import type { ProfileUser } from '@/components/perfil/ProfileForm';

/**
 * `/perfil` — Página de perfil do usuário (Tasks 11.3, 11.4, 11.5, 11.6 / Req 12).
 *
 * Server Component que busca os dados do usuário autenticado e renderiza o
 * `ProfileForm` client-side com os dados pré-preenchidos.
 */

export const metadata: Metadata = {
  title: 'Meu Perfil',
  description: 'Visualize e edite as suas informações pessoais.',
};

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let profileUser: ProfileUser;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        area: true,
        position: true,
        phone: true,
        cpf: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      redirect('/login');
    }

    profileUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      area: user.area,
      position: user.position,
      phone: user.phone,
      cpf: user.cpf,
      avatarUrl: user.avatarUrl,
      status: session.user.status,
    };
  } catch (err) {
    console.error('[perfil] DB error:', err);
    // Fallback with session data
    profileUser = {
      id: session.user.id,
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      role: session.user.role ?? 'MEMBRO',
      area: session.user.area ?? null,
      position: null,
      phone: null,
      cpf: null,
      avatarUrl: null,
      status: session.user.status,
    };
  }

  return (
    <section
      aria-labelledby="perfil-heading"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">Conta</p>
        <h1
          id="perfil-heading"
          className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
        >
          Meu Perfil
        </h1>
        <p className="text-text-secondary">Gerencie suas informações pessoais de contato.</p>
      </header>

      <div className="rounded-xl border border-border-light bg-surface-card p-6 shadow-sm">
        <ProfileForm user={profileUser} />
      </div>
    </section>
  );
}
