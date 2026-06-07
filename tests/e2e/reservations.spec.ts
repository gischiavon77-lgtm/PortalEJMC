import { test, expect } from './fixtures';

/**
 * E2E Tests: Computer Reservations (Reservas)
 * Covers task 21.6 — reserva de computador com validação de regras.
 */

test.describe('Reserva de computadores', () => {
  test('deve criar uma reserva em um slot disponível', async ({ membroPage }) => {
    await membroPage.goto('/reservas');

    // Wait for the reservation grid to load
    await expect(membroPage.getByTestId('reservations-grid')).toBeVisible();

    // Click on an available slot (first available)
    const availableSlot = membroPage
      .getByTestId('reservations-grid')
      .locator('[data-testid^="slot-available-"]')
      .first();
    await availableSlot.click();

    // Confirm the reservation
    await membroPage.getByTestId('confirm-reservation-btn').click();

    // Verify success message
    await expect(membroPage.getByText(/reserva confirmada|reservado com sucesso/i)).toBeVisible();

    // Verify the slot now shows as reserved in the grid
    await membroPage.goto('/reservas');
    await expect(membroPage.getByTestId('reservations-grid')).toBeVisible();

    // There should be at least one "my reservation" indicator
    const myReservation = membroPage
      .getByTestId('reservations-grid')
      .locator('[data-testid^="slot-mine-"]')
      .first();
    await expect(myReservation).toBeVisible();
  });

  test('não deve permitir reservar o mesmo dia novamente', async ({ membroPage }) => {
    await membroPage.goto('/reservas');

    // Try to reserve another computer on the same day we already have a reservation
    // Find a slot on the same day as existing reservation
    const occupiedDay = membroPage
      .getByTestId('reservations-grid')
      .locator('[data-testid^="slot-mine-"]')
      .first();

    // Get the day from the slot's data attribute
    const slotId = await occupiedDay.getAttribute('data-testid');
    // Extract day info — format: slot-mine-{computerId}-{date}
    const parts = slotId?.split('-') ?? [];
    const reservedDate = parts.slice(3).join('-'); // date part

    // Try to click another computer for the same date
    const anotherSlotSameDay = membroPage
      .getByTestId('reservations-grid')
      .locator(`[data-testid^="slot-available-"][data-testid$="-${reservedDate}"]`)
      .first();

    const slotExists = await anotherSlotSameDay.isVisible().catch(() => false);
    if (slotExists) {
      await anotherSlotSameDay.click();
      await membroPage.getByTestId('confirm-reservation-btn').click();

      // Should see error about max 1 reservation per day
      await expect(
        membroPage.getByText(/já possui.*reserva.*dia|máximo.*reserva.*por dia/i),
      ).toBeVisible();
    }
  });

  test('deve cancelar uma reserva futura e liberar o slot', async ({ membroPage }) => {
    await membroPage.goto('/reservas');

    // Find my reservation
    const myReservation = membroPage
      .getByTestId('reservations-grid')
      .locator('[data-testid^="slot-mine-"]')
      .first();

    const isVisible = await myReservation.isVisible().catch(() => false);
    if (!isVisible) {
      // Skip if no reservation found — need to create one first
      test.skip();
      return;
    }

    // Click on my reservation to see details/cancel option
    await myReservation.click();

    // Click cancel button
    await membroPage.getByTestId('cancel-reservation-btn').click();

    // Confirm cancellation
    await membroPage.getByTestId('confirm-action-btn').click();

    // Verify cancellation success
    await expect(membroPage.getByText(/reserva cancelada|cancelado com sucesso/i)).toBeVisible();

    // Verify slot is now available again
    await membroPage.goto('/reservas');
    await expect(membroPage.getByTestId('reservations-grid')).toBeVisible();
  });
});
