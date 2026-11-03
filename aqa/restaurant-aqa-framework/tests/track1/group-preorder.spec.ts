import { expect, test } from '@playwright/test';
import {
  config,
  hasEmptyGroupConfig,
  hasNonOwnerApiConfig,
  hasSubmitUiConfig,
  hasViewUiConfig,
} from '../config';
import { GroupOrderApi } from '../support/api/group-order-api';
import { GroupOrderPage } from '../support/page-objects/group-order-page';
import { LoginPage } from '../support/page-objects/login-page';

test.describe('Track 1 — Group Pre-Order', () => {
  test('@level1 @ui owner can view the group order page', async ({ page }) => {
    test.skip(
      !hasViewUiConfig,
      'Configure FRONTEND_URL, TEST_VIEW_RESERVATION_ID, OWNER_EMAIL and OWNER_PASSWORD.'
    );

    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.signIn(config.ownerEmail, config.ownerPassword);

    const groupOrderPage = new GroupOrderPage(page);
    await groupOrderPage.open(config.viewReservationId);
    await groupOrderPage.expectHeader();
    await groupOrderPage.expectParticipantsList();
  });

  test('@level2 @ui owner can submit the consolidated pre-order', async ({ page }) => {
    test.skip(
      !hasSubmitUiConfig,
      'Configure FRONTEND_URL, TEST_SUBMIT_RESERVATION_ID, OWNER_EMAIL and OWNER_PASSWORD.'
    );

    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.signIn(config.ownerEmail, config.ownerPassword);

    const groupOrderPage = new GroupOrderPage(page);
    await groupOrderPage.open(config.submitReservationId);
    await groupOrderPage.submitPreOrder();
  });

  test('@level2 @api non-owner cannot submit the group pre-order', async ({ request }) => {
    test.skip(
      !hasNonOwnerApiConfig,
      'Configure API_BASE_URL, the forbidden test reservation/group IDs, and guest credentials.'
    );

    const api = new GroupOrderApi(request, config.apiBaseUrl);
    const guestToken = await api.signIn(config.guestEmail, config.guestPassword);
    const response = await api.submitGroupPreOrder(
      config.forbiddenGroupReservationId,
      config.forbiddenReservationId,
      guestToken
    );

    expect([400, 401, 403, 404]).toContain(response.status);
  });

  test('@level1 @api empty group returns an empty participants list and total 0', async ({ request }) => {
    test.skip(!hasEmptyGroupConfig, 'Configure API_BASE_URL, EMPTY_GROUP_RESERVATION_ID and owner credentials.');

    const api = new GroupOrderApi(request, config.apiBaseUrl);
    const ownerToken = await api.signIn(config.ownerEmail, config.ownerPassword);
    const body = await api.getGroupSessions(config.emptyGroupReservationId, ownerToken);

    expect(Array.isArray(body.participants)).toBeTruthy();
    expect(body.participants).toEqual([]);
    expect(body.total).toBe(0);
  });
});
