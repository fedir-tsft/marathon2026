import { type APIRequestContext } from '@playwright/test';

export type SignInResponse = {
  accessToken?: string;
  idToken?: string;
  token?: string;
  message?: string;
};

export type GroupSessionsResponse = {
  participants: Array<{
    id: string;
    type: string;
    name: string;
    total: number;
    isSubmitted: boolean;
    items: Array<{
      dish: {
        id: string;
        name: string;
        price: number;
      };
      quantity: number;
    }>;
  }>;
  total: number;
};

export class GroupOrderApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly apiBaseUrl: string
  ) {}

  async signIn(email: string, password: string): Promise<string> {
    const response = await this.request.post(`${this.apiBaseUrl}/signin`, {
      data: {
        email,
        password,
      },
    });

    if (!response.ok()) {
      throw new Error(`Signin failed with status ${response.status()}: ${await response.text()}`);
    }

    const body = (await response.json()) as SignInResponse;
    const token = body.accessToken ?? body.idToken ?? body.token;
    if (!token) {
      throw new Error(`Signin response did not include an auth token: ${JSON.stringify(body)}`);
    }
    return token;
  }

  async getGroupSessions(groupReservationId: string, token?: string): Promise<GroupSessionsResponse> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await this.request.get(`${this.apiBaseUrl}/guest/groups/${groupReservationId}/sessions`, {
      headers,
    });
    if (!response.ok()) {
      throw new Error(`GET /guest/groups/${groupReservationId}/sessions failed with ${response.status()}`);
    }
    return (await response.json()) as GroupSessionsResponse;
  }

  async submitGroupPreOrder(
    groupReservationId: string,
    reservationId: string,
    token?: string
  ): Promise<{ status: number; body: string; ok: boolean }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await this.request.post(`${this.apiBaseUrl}/group-reservations/${groupReservationId}/submit`, {
      headers,
      data: {
        reservationId,
      },
    });

    const body = await response.text();
    return {
      status: response.status(),
      body,
      ok: response.ok(),
    };
  }
}
