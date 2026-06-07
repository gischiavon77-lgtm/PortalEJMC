import { test, expect } from './fixtures';

/**
 * E2E Tests: Permission control
 * Covers task 21.8 — membro tenta acessar /admin → 403.
 */

test.describe('Controle de permissão — acesso restrito', () => {
  test('membro deve ser redirecionado para /403 ao tentar acessar /admin', async ({
    membroPage,
  }) => {
    // Directly navigate to admin area
    await membroPage.goto('/admin');

    // Should be redirected to the 403 page
    await membroPage.waitForURL('**/403', { timeout: 10_000 });

    // Verify we're on the 403 page
    expect(membroPage.url()).toContain('/403');
  });

  test('página 403 deve exibir mensagem de "acesso restrito"', async ({ membroPage }) => {
    await membroPage.goto('/admin');

    // Wait for redirect to 403
    await membroPage.waitForURL('**/403', { timeout: 10_000 });

    // Verify the 403 page displays the appropriate message
    await expect(
      membroPage.getByText(/acesso restrito|sem permissão|não autorizado/i),
    ).toBeVisible();
  });

  test('membro não deve ver o item "Admin" no menu de navegação', async ({ membroPage }) => {
    await membroPage.goto('/dashboard');

    // Desktop viewport — check sidebar items
    await membroPage.setViewportSize({ width: 1440, height: 900 });

    const sidebar = membroPage.getByTestId('sidebar');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    if (sidebarVisible) {
      // Admin menu item should NOT be visible for membro
      await expect(sidebar.getByText('Admin')).not.toBeVisible();
    }
  });

  test('admin deve conseguir acessar /admin normalmente', async ({ adminPage }) => {
    await adminPage.goto('/admin');

    // Should NOT be redirected — stays on /admin
    await expect(adminPage).toHaveURL(/.*\/admin/);

    // Admin page content should be visible
    await expect(adminPage.getByTestId('admin-page-header')).toBeVisible();
  });

  test('membro não deve acessar rotas de configuração de admin', async ({ membroPage }) => {
    // Try to access admin API endpoint directly via navigation
    await membroPage.goto('/admin/users');

    // Should be redirected to 403
    await membroPage.waitForURL('**/403', { timeout: 10_000 });
    await expect(
      membroPage.getByText(/acesso restrito|sem permissão|não autorizado/i),
    ).toBeVisible();
  });
});
