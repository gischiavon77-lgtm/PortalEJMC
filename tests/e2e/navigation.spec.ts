import { test, expect } from './fixtures';

/**
 * E2E Tests: Responsive navigation
 * Covers task 21.4 — sidebar in desktop, hamburger in mobile.
 */

test.describe('Navegação responsiva', () => {
  test('desktop: sidebar deve estar visível permanentemente', async ({ membroPage }) => {
    // Set desktop viewport (already set via project config for desktop project)
    await membroPage.setViewportSize({ width: 1440, height: 900 });
    await membroPage.goto('/dashboard');

    // Sidebar should be visible
    const sidebar = membroPage.getByTestId('sidebar');
    await expect(sidebar).toBeVisible();

    // Hamburger button should NOT be visible on desktop
    const hamburger = membroPage.getByTestId('hamburger-btn');
    await expect(hamburger).not.toBeVisible();

    // Navigation items should be visible
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
    await expect(sidebar.getByText('Membros')).toBeVisible();
  });

  test('mobile: sidebar deve estar oculta, hamburger visível', async ({ membroPage }) => {
    // Set mobile viewport
    await membroPage.setViewportSize({ width: 320, height: 720 });
    await membroPage.goto('/dashboard');

    // Sidebar should be hidden initially
    const sidebar = membroPage.getByTestId('sidebar');
    await expect(sidebar).not.toBeVisible();

    // Hamburger button should be visible
    const hamburger = membroPage.getByTestId('hamburger-btn');
    await expect(hamburger).toBeVisible();
  });

  test('mobile: clicar no hamburger deve abrir a sidebar', async ({ membroPage }) => {
    await membroPage.setViewportSize({ width: 320, height: 720 });
    await membroPage.goto('/dashboard');

    const sidebar = membroPage.getByTestId('sidebar');
    const hamburger = membroPage.getByTestId('hamburger-btn');

    // Click hamburger to open
    await hamburger.click();
    await expect(sidebar).toBeVisible();

    // Navigation items should now be accessible
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
  });

  test('mobile: clicar no hamburger novamente deve fechar a sidebar', async ({ membroPage }) => {
    await membroPage.setViewportSize({ width: 320, height: 720 });
    await membroPage.goto('/dashboard');

    const sidebar = membroPage.getByTestId('sidebar');
    const hamburger = membroPage.getByTestId('hamburger-btn');

    // Open sidebar
    await hamburger.click();
    await expect(sidebar).toBeVisible();

    // Close sidebar
    await hamburger.click();
    await expect(sidebar).not.toBeVisible();
  });

  test('tablet: sidebar deve se comportar adequadamente em 768px', async ({ membroPage }) => {
    await membroPage.setViewportSize({ width: 768, height: 1024 });
    await membroPage.goto('/dashboard');

    // On tablet, sidebar behavior depends on implementation
    // At 768px the sidebar may be visible or collapsed
    const sidebar = membroPage.getByTestId('sidebar');
    const hamburger = membroPage.getByTestId('hamburger-btn');

    // At least one navigation mechanism should be available
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const hamburgerVisible = await hamburger.isVisible().catch(() => false);

    expect(sidebarVisible || hamburgerVisible).toBeTruthy();
  });
});
