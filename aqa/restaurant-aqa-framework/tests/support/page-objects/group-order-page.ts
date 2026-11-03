import { type Page, expect } from '@playwright/test';

export class GroupOrderPage {
  constructor(private readonly page: Page) {}

  async open(reservationId: string): Promise<void> {
    await this.page.goto(`/reservations/${reservationId}/group-order`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectHeader(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /group pre-order/i })).toBeVisible();
  }

  async expectParticipantsList(): Promise<void> {
    expect(await this.page.locator('app-participant-card').count()).toBeGreaterThan(0);
  }

  async submitPreOrder(): Promise<void> {
    const submitButton = this.page.getByRole('button', { name: /submit pre-order|submit|send to restaurant/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    await this.page.getByRole('button', { name: /submit/i }).last().click();
    await expect(this.page.getByText(/sent to restaurant|submitted/i)).toBeVisible();
  }
}
