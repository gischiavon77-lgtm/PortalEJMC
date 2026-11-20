import { test, expect } from './fixtures';

/**
 * E2E (Fase 4 da reforma): um evento futuro criado no calendário aparece
 * em "Próximos Eventos" na página inicial, com a categoria escolhida.
 *
 * Roda contra o app e o banco reais (`npm run test:e2e`). Precisa de banco
 * com seed e do usuário de teste "coordenador" de `fixtures.ts`.
 *
 * O evento é marcado para amanhã às 09:00, para ficar entre os próximos
 * mesmo que o banco já tenha outros eventos (a lista mostra os 5 primeiros).
 */

function tomorrowAt9(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tomorrowAt10(): string {
  return tomorrowAt9().replace('T09:00', 'T10:00');
}

test.describe('Cronograma — evento futuro em "Próximos Eventos"', () => {
  const title = `Evento E2E ${Date.now()}`;

  test('coordenador cria evento e ele aparece na página inicial', async ({ coordenadorPage }) => {
    await coordenadorPage.goto('/cronograma');

    await coordenadorPage.getByRole('button', { name: /novo evento/i }).click();
    await coordenadorPage.getByLabel('Título').fill(title);
    await coordenadorPage.getByTestId('event-category').selectOption('CAPACITACAO');
    await coordenadorPage.getByLabel('Início').fill(tomorrowAt9());
    await coordenadorPage.getByLabel('Fim').fill(tomorrowAt10());
    await coordenadorPage.getByRole('button', { name: 'Criar evento' }).click();

    // O evento aparece no calendário com a categoria escolhida.
    await expect(
      coordenadorPage.locator('[data-testid="calendar-event"][data-category="CAPACITACAO"]', {
        hasText: title,
      }),
    ).toBeVisible();

    // E na página inicial, em "Próximos Eventos".
    await coordenadorPage.goto('/dashboard');
    const upcoming = coordenadorPage.getByTestId('home-upcoming-events');
    await expect(upcoming.getByText(title)).toBeVisible();
    await expect(upcoming.getByText('Capacitação').first()).toBeVisible();
    await expect(upcoming.getByText('09:00').first()).toBeVisible();
  });
});
