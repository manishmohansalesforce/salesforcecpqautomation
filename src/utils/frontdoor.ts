import { type Page } from '@playwright/test';
import { isFrontdoorUrl, waitForLightningReady } from './lightning';
import { type SalesforceSession } from './oauth';

export async function openLightningWithFrontdoor(page: Page, session: SalesforceSession): Promise<void> {
  const retURL = '/lightning/page/home';
  const frontdoor =
    `${session.instanceUrl}/secur/frontdoor.jsp` +
    `?sid=${encodeURIComponent(session.accessToken)}` +
    `&retURL=${encodeURIComponent(retURL)}`;

  await page.goto(frontdoor, { waitUntil: 'commit' });
  await page.waitForURL((url) => /\/lightning\//.test(url.href) && !isFrontdoorUrl(url.href), {
    timeout: 90_000,
    waitUntil: 'domcontentloaded',
  });
  await waitForLightningReady(page);
}
