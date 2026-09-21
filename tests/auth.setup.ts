import fs from 'fs';
import { test as setup } from '@playwright/test';
import { AUTH_FILE, ensureAuthDir, env } from '../src/config/env';
import { authenticateSalesforce } from '../src/utils/auth';
import { openLightningWithFrontdoor } from '../src/utils/frontdoor';
import { isLightningAuthenticated, waitForLightningReady } from '../src/utils/lightning';
import { hasRefreshTokenAuth, refreshSalesforceSession } from '../src/utils/oauth';

setup.setTimeout(5 * 60_000);

setup('reuse or capture Salesforce auth state', async ({ browser }) => {
  ensureAuthDir();

  const headed = setup.info().project.use.headless === false;
  const inCi = Boolean(process.env.CI);

  if (inCi && !fs.existsSync(AUTH_FILE) && !hasRefreshTokenAuth()) {
    throw new Error(
      'CI cannot receive a mobile OTP. Set the SF_AUTH_URL GitHub secret (sfdxAuthUrl from `sf org login web` + `npm run auth:url`). Setup refreshes that token and opens Lightning through frontdoor.jsp — no phone prompt.',
    );
  }

  if (fs.existsSync(AUTH_FILE)) {
    const existing = await browser.newContext({ storageState: AUTH_FILE });
    const page = await existing.newPage();
    await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });

    if (await isLightningAuthenticated(page)) {
      await waitForLightningReady(page);
      await existing.storageState({ path: AUTH_FILE });
      await existing.close();
      return;
    }

    await existing.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  if (hasRefreshTokenAuth()) {
    console.log('[auth] Refreshing Salesforce session from SF_AUTH_URL (no mobile OTP).');
    const session = await refreshSalesforceSession();
    await openLightningWithFrontdoor(page, session);
  } else {
    await authenticateSalesforce(page, { headed, allowManualMfa: headed && !inCi });
  }

  await context.storageState({ path: AUTH_FILE });
  await context.close();
});
