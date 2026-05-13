# `tests/property`

Testes de propriedade (property-based testing) com **fast-check** + **Vitest**.

- 100 iterações mínimas por propriedade (configurar via `fc.assert(prop, { numRuns: 100 })`).
- Cada arquivo cobre UMA propriedade do design (`design.md` — seção “Propriedades de Corretude”).
- Convenção de nome: `propXX-descricao.property.test.ts` (ex: `prop01-generic-error.property.test.ts`).

As 17 propriedades a serem implementadas estão na Task 20 do `tasks.md`.
