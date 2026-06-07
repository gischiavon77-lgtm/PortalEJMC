import { test as base, type Page } from '@playwright/test';

/**
 * Roles and credentials for E2E test sessions.
 * These match the seeded users in the database (prisma/seed.ts).
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@ejmc.com.br',
    password: 'Admin123!',
    name: 'Admin EJMC',
    role: 'ADMIN',
  },
  diretor: {
    email: 'diretor@ejmc.com.br',
    password: 'Diretor123!',
    name: 'Diretor EJMC',
    role: 'DIRETOR',
  },
  coordenador: {
    email: 'coordenador@ejmc.com.br',
    password: 'Coord123!',
    name: 'Coordenador EJMC',
    role: 'COORDENADOR',
  },
  membro: {
    email: 'membro@ejmc.com.br',
    password: 'Membro123!',
    name: 'Membro EJMC',
    role: 'MEMBRO',
  },
} as const;

type Role = keyof typeof TEST_USERS;

/**
 * Logs in a user via the login form.
 * Waits for redirect to /dashboard to confirm success.
 */
async function loginAs(page: Page, role: Role): Promise<void> {
  const user = TEST_USERS[role];

  await page.goto('/login');
  await page.getByTestId('login-email').fill(user.email);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByTestId('login-submit').click();

  // Wait for successful redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Custom fixtures extending Playwright's base test.
 * Provides pre-authenticated page instances for each role.
 */
type Fixtures = {
  adminPage: Page;
  diretorPage: Page;
  coordenadorPage: Page;
  membroPage: Page;
  loginAs: (page: Page, role: Role) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'admin');
    await use(page);
    await context.close();
  },

  diretorPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'diretor');
    await use(page);
    await context.close();
  },

  coordenadorPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'coordenador');
    await use(page);
    await context.close();
  },

  membroPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, 'membro');
    await use(page);
    await context.close();
  },

  loginAs: async ({}, use) => {
    await use(loginAs);
  },
});

export { expect } from '@playwright/test';
