import { test as base, APIRequestContext, request } from '@playwright/test';

type ApiFixtures = {
  apiRequest: APIRequestContext;
};

export const test = base.extend<ApiFixtures>({
  apiRequest: async ({}, use) => {
    const apiContext = await request.newContext({
      baseURL: process.env.API_BASE_URL || 'https://l2p.korczewski.de',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    await use(apiContext);
    await apiContext.dispose();
  },
});

export { expect } from '@playwright/test';
