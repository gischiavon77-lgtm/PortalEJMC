/**
 * Property-Based Tests — CPF Validation (Property 12)
 *
 * Valida: Requisitos 12.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateCpf } from '@/lib/validators/profile';

const NUM_RUNS = 100;

// ─── Property 12: Validação de CPF ───────────────────────────────────
// **Validates: Requirements 12.3**

describe('Property 12: Validação de CPF', () => {
  /**
   * Generates a valid CPF using the official algorithm (modulo 11).
   */
  function generateValidCpf(baseDigits: number[]): string {
    const calcDigit = (slice: number[], weights: number[]): number => {
      const sum = slice.reduce((acc, d, i) => acc + d * weights[i]!, 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const firstWeights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const secondWeights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

    const d1 = calcDigit(baseDigits.slice(0, 9), firstWeights);
    const d2 = calcDigit([...baseDigits.slice(0, 9), d1], secondWeights);

    return [...baseDigits.slice(0, 9), d1, d2].join('');
  }

  // Generator for 9 base digits that won't produce all-same CPF
  const validBaseDigits = fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
    .filter((digits) => !digits.every((d) => d === digits[0]));

  it('CPFs computed with correct check digits pass validation', () => {
    fc.assert(
      fc.property(validBaseDigits, (baseDigits) => {
        const cpf = generateValidCpf(baseDigits);
        expect(validateCpf(cpf)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('all-same-digit CPFs are rejected', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (digit) => {
        const cpf = digit.toString().repeat(11);
        expect(validateCpf(cpf)).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('CPFs with incorrect check digits are rejected', () => {
    fc.assert(
      fc.property(validBaseDigits, fc.integer({ min: 1, max: 9 }), (baseDigits, offset) => {
        const validCpf = generateValidCpf(baseDigits);
        // Corrupt the first check digit
        const digits = validCpf.split('').map(Number);
        digits[9] = (digits[9]! + offset) % 10;
        const corruptedCpf = digits.join('');

        // Might still pass if the corruption happens to produce a valid CPF
        // (very unlikely), so we just verify it's not the same as valid
        if (corruptedCpf !== validCpf) {
          expect(validateCpf(corruptedCpf)).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('strings with wrong length are rejected', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 20 })
          .filter((arr) => arr.length !== 11)
          .map((arr) => arr.join('')),
        (nonElevenDigits) => {
          expect(validateCpf(nonElevenDigits)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('CPF validation is deterministic (same input → same result)', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer({ min: 0, max: 9 }), { minLength: 11, maxLength: 11 })
          .map((arr) => arr.join('')),
        (cpf) => {
          const result1 = validateCpf(cpf);
          const result2 = validateCpf(cpf);
          expect(result1).toBe(result2);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
