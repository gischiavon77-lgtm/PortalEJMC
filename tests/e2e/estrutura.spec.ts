import { test, expect } from './fixtures';

/**
 * E2E (Fase 5 da reforma): a Estrutura lista as seis áreas e abre o
 * organograma de uma delas. O endereço antigo `/membros` redireciona.
 *
 * Roda contra o app e o banco reais (`npm run test:e2e`). Precisa de banco
 * com seed e do usuário de teste "membro" de `fixtures.ts`.
 */

test.describe('Estrutura', () => {
  test('membro vê as áreas e abre o organograma de uma área', async ({ membroPage }) => {
    await membroPage.goto('/membros');
    await expect(membroPage).toHaveURL(/\/estrutura$/);

    await expect(membroPage.getByRole('heading', { name: 'Estrutura', level: 1 })).toBeVisible();
    await expect(membroPage.locator('[data-testid^="area-card-"]')).toHaveCount(6);

    await membroPage.getByTestId('area-card-PRESIDENCIA').click();
    await expect(membroPage).toHaveURL(/\/estrutura\/presidencia$/);
    await expect(membroPage.getByRole('heading', { name: 'Presidência', level: 1 })).toBeVisible();
    await expect(membroPage.getByRole('link', { name: /estrutura/i })).toBeVisible();
  });

  test('área inexistente responde 404', async ({ membroPage }) => {
    const res = await membroPage.goto('/estrutura/financeiro');
    expect(res?.status()).toBe(404);
  });
});
