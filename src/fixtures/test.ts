import { test as base } from '@playwright/test';
import { AppLauncher } from '../pages/AppLauncher';
import { HomePage } from '../pages/HomePage';

type SalesforceFixtures = {
  homePage: HomePage;
  appLauncher: AppLauncher;
};

export const test = base.extend<SalesforceFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  appLauncher: async ({ page }, use) => {
    await use(new AppLauncher(page));
  },
});

export { expect } from '@playwright/test';
