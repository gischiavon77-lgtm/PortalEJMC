import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Garante que o DOM é limpo após cada teste para evitar vazamento de estado entre os casos.
afterEach(() => {
  cleanup();
});
