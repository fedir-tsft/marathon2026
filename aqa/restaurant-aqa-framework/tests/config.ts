import dotenv from 'dotenv';

dotenv.config();

export const config = {
  frontendUrl: process.env.FRONTEND_URL ?? '',
  apiBaseUrl: process.env.API_BASE_URL ?? '',
  forbiddenReservationId: process.env.TEST_FORBIDDEN_RESERVATION_ID ?? '',
  forbiddenGroupReservationId: process.env.TEST_FORBIDDEN_GROUP_RESERVATION_ID ?? '',
  emptyGroupReservationId: process.env.EMPTY_GROUP_RESERVATION_ID ?? '',
  ownerEmail: process.env.OWNER_EMAIL ?? '',
  ownerPassword: process.env.OWNER_PASSWORD ?? '',
  guestEmail: process.env.GUEST_EMAIL ?? '',
  guestPassword: process.env.GUEST_PASSWORD ?? '',
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const hasViewUiConfig = Boolean(
  isHttpUrl(config.frontendUrl) &&
    isHttpUrl(config.apiBaseUrl) &&
    config.ownerEmail &&
    config.ownerPassword
);

export const hasSubmitUiConfig = Boolean(
  isHttpUrl(config.frontendUrl) &&
    isHttpUrl(config.apiBaseUrl) &&
    config.ownerEmail &&
    config.ownerPassword
);

export const hasNonOwnerApiConfig = Boolean(
  isHttpUrl(config.apiBaseUrl) &&
    config.forbiddenReservationId &&
    config.forbiddenGroupReservationId &&
    config.guestEmail &&
    config.guestPassword
);

export const hasEmptyGroupConfig = Boolean(
  isHttpUrl(config.apiBaseUrl) &&
    config.emptyGroupReservationId &&
    config.ownerEmail &&
    config.ownerPassword
);
