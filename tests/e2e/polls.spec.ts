import { test, expect } from './fixtures';

/**
 * E2E Tests: Polls (Enquetes)
 * Covers task 21.5 — criação e votação em enquete.
 */

test.describe('Enquetes — criação e votação', () => {
  const pollData = {
    title: `Enquete E2E ${Date.now()}`,
    description: 'Enquete criada automaticamente pelo teste E2E',
    options: ['Opção A', 'Opção B', 'Opção C'],
  };

  test('diretor deve criar uma nova enquete', async ({ diretorPage }) => {
    await diretorPage.goto('/enquetes');

    // Click "Nova enquete" button
    await diretorPage.getByTestId('new-poll-btn').click();

    // Fill the poll form
    await diretorPage.getByTestId('poll-title').fill(pollData.title);
    await diretorPage.getByTestId('poll-description').fill(pollData.description);

    // Add options
    for (let i = 0; i < pollData.options.length; i++) {
      if (i >= 2) {
        // First 2 options are available by default, add more
        await diretorPage.getByTestId('add-option-btn').click();
      }
      await diretorPage.getByTestId(`poll-option-${i}`).fill(pollData.options[i]);
    }

    // Submit the poll
    await diretorPage.getByTestId('submit-poll-btn').click();

    // Verify success message or redirect
    await expect(diretorPage.getByText(/enquete criada|sucesso/i)).toBeVisible();

    // Verify poll appears in the list
    await diretorPage.goto('/enquetes');
    await expect(diretorPage.getByText(pollData.title)).toBeVisible();
  });

  test('membro deve votar em uma enquete', async ({ membroPage }) => {
    await membroPage.goto('/enquetes');

    // Find an active poll and click on it
    const pollCard = membroPage
      .getByTestId('polls-list')
      .locator('[data-testid="poll-card"]')
      .first();
    await pollCard.click();

    // Select an option to vote
    const voteOption = membroPage.getByTestId('poll-option-vote-0');
    await voteOption.click();

    // Confirm vote
    await membroPage.getByTestId('confirm-vote-btn').click();

    // Verify vote was registered
    await expect(membroPage.getByText(/voto registrado|votou/i)).toBeVisible();
  });

  test('membro não deve conseguir votar duas vezes na mesma enquete', async ({ membroPage }) => {
    await membroPage.goto('/enquetes');

    // Find a poll we already voted on
    const pollCard = membroPage
      .getByTestId('polls-list')
      .locator('[data-testid="poll-card"]')
      .first();
    await pollCard.click();

    // Try to vote again
    const voteOption = membroPage.getByTestId('poll-option-vote-1');
    await voteOption.click();

    await membroPage.getByTestId('confirm-vote-btn').click();

    // Verify duplicate vote is blocked
    await expect(
      membroPage.getByText(/já votou|voto duplicado|não é possível votar novamente/i),
    ).toBeVisible();
  });
});
