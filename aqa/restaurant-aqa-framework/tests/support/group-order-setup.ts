import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type Browser, type BrowserContext, type Page, expect } from '@playwright/test';
import { GroupOrderApi } from './api/group-order-api';
import { LoginPage } from './page-objects/login-page';

const PARTY_SIZE = 2;

export type CreatedGroupOrder = {
  reservationId: string;
  guestName: string;
  dishNames: string[];
};

export class GroupOrderSetup {
  private readonly api: GroupOrderApi;
  private ownerToken = '';
  private reservationId: string | null = null;
  private guestContext: BrowserContext | null = null;

  constructor(
    private readonly ownerPage: Page,
    private readonly browser: Browser,
    request: APIRequestContext,
    apiBaseUrl: string
  ) {
    this.api = new GroupOrderApi(request, apiBaseUrl);
  }

  async create(email: string, password: string): Promise<CreatedGroupOrder> {
    this.ownerToken = await this.api.signIn(email, password);

    const loginPage = new LoginPage(this.ownerPage);
    await loginPage.open();
    await loginPage.signIn(email, password);

    await this.ownerPage.goto('/tables');
    await expect(this.ownerPage.getByRole('heading', { name: 'Book a Table' })).toBeVisible();
    await this.selectReservationSlot();

    const createdResponsePromise = this.ownerPage.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/reservations')
      );
    });
    await this.ownerPage.getByRole('button', { name: 'Confirm', exact: true }).click();
    const createdResponse = await createdResponsePromise;
    if (!createdResponse.ok()) {
      throw new Error(`Reservation creation failed with ${createdResponse.status()}.`);
    }

    const reservation = (await createdResponse.json()) as { id?: string };
    if (!reservation.id) {
      throw new Error('Reservation creation response did not include an ID.');
    }
    this.reservationId = reservation.id;

    const inviteLinkInput = this.ownerPage.getByLabel('Invite Link');
    await expect(inviteLinkInput).toHaveValue(/\/join\/[^/]+$/);
    const inviteLink = await inviteLinkInput.inputValue();

    const guestName = `AQA Guest ${randomUUID().slice(0, 8)}`;
    this.guestContext = await this.browser.newContext();
    const guestPage = await this.guestContext.newPage();
    await guestPage.goto(inviteLink);
    await guestPage.getByLabel('Enter Your Name').fill(guestName);
    await guestPage.getByRole('button', { name: 'Browse Menu' }).click();

    await expect(guestPage.locator('.dish-card').first()).toBeVisible();
    const dishCards = guestPage.locator('.dish-card');
    const dishNames: string[] = [];
    for (let index = 0; index < await dishCards.count(); index += 1) {
      const card = dishCards.nth(index);
      const preOrderButton = card.getByRole('button', { name: 'Pre-Order' });
      if (await preOrderButton.isEnabled()) {
        dishNames.push((await card.locator('.dish-name').innerText()).trim());
        await preOrderButton.click();
        if (dishNames.length === 2) break;
      }
    }

    if (dishNames.length < 2) {
      throw new Error('The guest menu must have at least two available dishes to pre-order.');
    }

    await guestPage.getByRole('button', { name: 'Open cart' }).click();
    const cart = guestPage.getByRole('dialog', { name: 'Cart' });
    for (const dishName of dishNames) {
      await expect(cart.getByText(dishName)).toBeVisible();
    }
    await guestPage.getByRole('button', { name: 'Submit Pre-Order', exact: true }).click();
    await expect(guestPage.getByRole('heading', { name: 'Pre-Order Submitted!' })).toBeVisible();

    return {
      reservationId: reservation.id,
      guestName,
      dishNames,
    };
  }

  async cleanup(): Promise<void> {
    try {
      if (this.reservationId) {
        if (!this.ownerToken) {
          throw new Error('Cannot cancel the test reservation without the owner token.');
        }
        await this.api.cancelReservation(this.reservationId, this.ownerToken);
      }
    } finally {
      await this.guestContext?.close();
    }
  }

  private async selectReservationSlot(): Promise<void> {
    const bookingFields = this.ownerPage.locator('.booking-card .field');
    const dateSelect = bookingFields.nth(1).getByRole('button');
    await dateSelect.click();
    await this.ownerPage.getByRole('option').nth(1).click();

    const guestCounter = this.ownerPage.locator('.field-guests');
    await guestCounter.getByRole('button', { name: 'Increase value' }).click();
    await expect(guestCounter.locator('.value')).toHaveText(String(PARTY_SIZE));

    const timeSelect = this.ownerPage.locator('.field-time').getByRole('button');
    await timeSelect.click();
    const timeOptions = await this.ownerPage.getByRole('option').allTextContents();
    await timeSelect.click();

    const availableSlots = this.ownerPage.locator('.table-card app-time-slot:not(:has(.disabled))');
    for (const time of timeOptions) {
      await timeSelect.click();
      await this.ownerPage.getByRole('option', { name: time, exact: true }).click();
      await this.ownerPage.getByRole('button', { name: 'Find a Table' }).click();

      const resultsSummary = this.ownerPage.locator('.results-summary');
      await expect(resultsSummary).toBeVisible();
      await expect(resultsSummary).not.toContainText('Searching for tables');

      if (await availableSlots.count()) {
        await availableSlots.first().click();
        await expect(
          this.ownerPage.getByRole('heading', { name: 'Review & Confirm Reservation' })
        ).toBeVisible();
        return;
      }
    }

    throw new Error('No available table was found for a two-person reservation in the date range.');
  }
}
