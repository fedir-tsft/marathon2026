import { expect, test } from '@playwright/test';
import {
  config,
  hasEmptyGroupConfig,
  hasNonOwnerApiConfig,
  hasSubmitUiConfig,
  hasViewUiConfig,
} from '../config';
import { GroupOrderApi } from '../support/api/group-order-api';
import { GroupOrderSetup } from '../support/group-order-setup';
import { GroupOrderPage } from '../support/page-objects/group-order-page';

function requireConfig(isConfigured: boolean, missingConfigMessage: string): void {
  if (isConfigured) return;

  if (process.env.CODEBUILD_BUILD_ID) {
    throw new Error(`CodeBuild test configuration is incomplete: ${missingConfigMessage}`);
  }

  test.skip(true, missingConfigMessage);
}

test.describe('Track 1 — Group Pre-Order', () => {
  test('@level1 @ui owner can view the group order page', async ({ page, browser, request }) => {
    requireConfig(
      hasViewUiConfig,
      'Configure FRONTEND_URL, API_BASE_URL, OWNER_EMAIL and OWNER_PASSWORD.'
    );

    const setup = new GroupOrderSetup(page, browser, request, config.apiBaseUrl);
    try {
      const group = await setup.create(
        config.ownerEmail,
        config.ownerPassword
      );
      const groupOrderPage = new GroupOrderPage(page);
      await groupOrderPage.open(group.reservationId);
      await groupOrderPage.expectHeader();
      await groupOrderPage.expectGuestOrder(group.guestName, group.dishNames);
    } finally {
      await setup.cleanup();
    }
  });

  test('@level2 @ui owner can submit the consolidated pre-order', async ({ page, browser, request }) => {
    requireConfig(
      hasSubmitUiConfig,
      'Configure FRONTEND_URL, API_BASE_URL, OWNER_EMAIL and OWNER_PASSWORD.'
    );

    const setup = new GroupOrderSetup(page, browser, request, config.apiBaseUrl);
    try {
      const group = await setup.create(
        config.ownerEmail,
        config.ownerPassword
      );
      const groupOrderPage = new GroupOrderPage(page);
      await groupOrderPage.open(group.reservationId);
      await groupOrderPage.expectGuestOrder(group.guestName, group.dishNames);
      await groupOrderPage.submitPreOrder();
    } finally {
      await setup.cleanup();
    }
  });

  test('@level2 @api non-owner cannot submit the group pre-order', async ({ request }) => {
    requireConfig(
      hasNonOwnerApiConfig,
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
    requireConfig(
      hasEmptyGroupConfig,
      'Configure API_BASE_URL, EMPTY_GROUP_RESERVATION_ID and owner credentials.'
    );

    const api = new GroupOrderApi(request, config.apiBaseUrl);
    const ownerToken = await api.signIn(config.ownerEmail, config.ownerPassword);
    const body = await api.getGroupSessions(config.emptyGroupReservationId, ownerToken);

    expect(Array.isArray(body.participants)).toBeTruthy();
    expect(body.participants).toEqual([]);
    expect(body.total).toBe(0);
  });
});
