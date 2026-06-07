import { test, expect, TEST_USERS } from './fixtures';

/**
 * E2E Tests: Authentication flows
 * Covers tasks 21.2 (cadastro → aprovação → login → dashboard)
 * and 21.3 (login inválido + bloqueio após 5 tentativas).
 */

test.describe('Fluxo completo de cadastro → aprovação → login → dashboard', () => {
  const newUser = {
    name: 'Novo Membro Teste',
    email: `teste.e2e.${Date.now()}@ejmc.com.br`,
    password: 'SenhaSegura1',
  };

  test('deve completar o fluxo: cadastro → aprovação por admin → login → dashboard', async ({
    page,
    adminPage,
  }) => {
    // 1. Navigate to /cadastro and fill the registration form
    await page.goto('/cadastro');

    await page.getByTestId('register-name').fill(newUser.name);
    await page.getByTestId('register-email').fill(newUser.email);
    await page.getByTestId('register-password').fill(newUser.password);
    await page.getByTestId('register-confirm-password').fill(newUser.password);
    await page.getByTestId('register-submit').click();

    // 2. Verify "aguardando aprovação" message
    await expect(page.getByText(/aguardando aprovação/i)).toBeVisible();

    // 3. Admin approves the new account
    await adminPage.goto('/admin');

    // Find the pending user and approve
    const pendingRow = adminPage.getByTestId('pending-users').getByText(newUser.email);
    await expect(pendingRow).toBeVisible();

    await adminPage
      .getByTestId('pending-users')
      .getByRole('row', { name: new RegExp(newUser.email) })
      .getByTestId('approve-user-btn')
      .click();

    // Confirm the approval action
    await adminPage.getByTestId('confirm-action-btn').click();

    // Wait for status change
    await expect(adminPage.getByText(/aprovado com sucesso/i)).toBeVisible();

    // 4. New user logs in with their credentials
    await page.goto('/login');
    await page.getByTestId('login-email').fill(newUser.email);
    await page.getByTestId('login-password').fill(newUser.password);
    await page.getByTestId('login-submit').click();

    // 5. Verify redirect to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
  });
});

test.describe('Login com credenciais inválidas', () => {
  test('deve mostrar mensagem de erro genérica para credenciais incorretas', async ({ page }) => {
    await page.goto('/login');

    // Try with wrong email
    await page.getByTestId('login-email').fill('naoexiste@ejmc.com.br');
    await page.getByTestId('login-password').fill('SenhaErrada1');
    await page.getByTestId('login-submit').click();

    // Verify generic error message (should NOT reveal which field is wrong)
    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/credenciais inválidas|email ou senha incorretos/i);

    // Error message must NOT contain hints like "email não encontrado" or "senha incorreta"
    await expect(errorMessage).not.toHaveText(/email não encontrado/i);
    await expect(errorMessage).not.toHaveText(/senha incorreta/i);
  });

  test('deve mostrar mensagem de erro genérica para senha errada com email válido', async ({
    page,
  }) => {
    await page.goto('/login');

    // Try with correct email but wrong password
    await page.getByTestId('login-email').fill(TEST_USERS.membro.email);
    await page.getByTestId('login-password').fill('SenhaCompletamenteErrada1');
    await page.getByTestId('login-submit').click();

    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    // Should be same generic message regardless of which credential is wrong
    await expect(errorMessage).toHaveText(/credenciais inválidas|email ou senha incorretos/i);
  });

  test('deve bloquear conta após 5 tentativas falhas consecutivas', async ({ page }) => {
    await page.goto('/login');

    const targetEmail = `locktest.${Date.now()}@ejmc.com.br`;

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('login-email').fill(targetEmail);
      await page.getByTestId('login-password').fill(`SenhaErrada${i}`);
      await page.getByTestId('login-submit').click();

      // Wait for error response before next attempt
      await expect(page.getByTestId('login-error')).toBeVisible();

      // Clear inputs for next attempt
      if (i < 4) {
        await page.getByTestId('login-email').clear();
        await page.getByTestId('login-password').clear();
      }
    }

    // 6th attempt should show lockout message
    await page.getByTestId('login-email').clear();
    await page.getByTestId('login-password').clear();
    await page.getByTestId('login-email').fill(targetEmail);
    await page.getByTestId('login-password').fill('SenhaErrada5');
    await page.getByTestId('login-submit').click();

    // Verify lockout message
    const lockoutMessage = page.getByTestId('login-error');
    await expect(lockoutMessage).toBeVisible();
    await expect(lockoutMessage).toHaveText(
      /conta bloqueada|muitas tentativas|tente novamente em/i,
    );
  });
});
