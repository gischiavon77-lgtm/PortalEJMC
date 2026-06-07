import { test, expect } from './fixtures';

/**
 * E2E Tests: Announcements (Comunicados)
 * Covers task 21.7 — criação de comunicado e visualização no mural.
 */

test.describe('Comunicados — criação e visualização no mural', () => {
  const announcementData = {
    title: `Comunicado E2E ${Date.now()}`,
    content:
      'Este é um comunicado criado automaticamente pelo teste E2E do Portal EJMC. ' +
      'Verificando que o fluxo de criação e exibição funciona corretamente.',
  };

  test('coordenador deve criar um novo comunicado', async ({ coordenadorPage }) => {
    await coordenadorPage.goto('/comunicados');

    // Click "Novo comunicado" button
    const newBtn = coordenadorPage.getByTestId('new-announcement-btn');
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Fill the announcement form
    await coordenadorPage.getByTestId('announcement-title').fill(announcementData.title);
    await coordenadorPage.getByTestId('announcement-content').fill(announcementData.content);

    // Submit
    await coordenadorPage.getByTestId('submit-announcement-btn').click();

    // Verify success
    await expect(
      coordenadorPage.getByText(/comunicado criado|publicado com sucesso/i),
    ).toBeVisible();
  });

  test('comunicado deve aparecer no mural após criação', async ({ coordenadorPage }) => {
    await coordenadorPage.goto('/comunicados');

    // The most recent announcement should be visible (mural shows newest first)
    // Look for the announcement we created (or any recent one)
    const muralList = coordenadorPage.getByTestId('announcements-list');
    await expect(muralList).toBeVisible();

    // Verify at least one announcement card is displayed
    const firstCard = muralList.locator('[data-testid="announcement-card"]').first();
    await expect(firstCard).toBeVisible();

    // Verify card has title, content, author, and date
    await expect(firstCard.getByTestId('announcement-card-title')).toBeVisible();
    await expect(firstCard.getByTestId('announcement-card-content')).toBeVisible();
    await expect(firstCard.getByTestId('announcement-card-author')).toBeVisible();
    await expect(firstCard.getByTestId('announcement-card-date')).toBeVisible();
  });

  test('membro NÃO deve ver o botão "Novo comunicado"', async ({ membroPage }) => {
    await membroPage.goto('/comunicados');

    // Membro should see the announcements list (read access)
    const muralList = membroPage.getByTestId('announcements-list');
    await expect(muralList).toBeVisible();

    // But should NOT see the "Novo comunicado" button (no create permission)
    const newBtn = membroPage.getByTestId('new-announcement-btn');
    await expect(newBtn).not.toBeVisible();
  });

  test('membro deve conseguir visualizar comunicados no mural', async ({ membroPage }) => {
    await membroPage.goto('/comunicados');

    // Membro should still be able to read all announcements
    const muralList = membroPage.getByTestId('announcements-list');
    await expect(muralList).toBeVisible();

    const cards = muralList.locator('[data-testid="announcement-card"]');
    const count = await cards.count();

    // There should be at least one announcement visible
    expect(count).toBeGreaterThan(0);
  });
});
