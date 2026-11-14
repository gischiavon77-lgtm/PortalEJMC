import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// A partir do Node 22+, o Node expõe um `localStorage` global próprio que
// fica `undefined` sem a flag `--localstorage-file` e acaba escondendo o
// `localStorage` do jsdom. Componentes que usam `window.localStorage`
// (ex.: `NotificationBell`) quebrariam nos testes. Quando isso acontece,
// instalamos um armazenamento em memória equivalente.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

// Garante que o DOM é limpo após cada teste para evitar vazamento de estado entre os casos.
afterEach(() => {
  cleanup();
});
