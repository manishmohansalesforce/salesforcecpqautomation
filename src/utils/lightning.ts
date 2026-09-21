import { expect, type Locator, type Page } from '@playwright/test';

const APP_LAUNCHER = (page: Page): Locator =>
  page
    .getByRole('button', { name: 'App Launcher' })
    .or(page.locator('one-app-launcher-header button, button.slds-icon-waffle_container'));

const LOGIN_USERNAME = (page: Page): Locator =>
  page.getByLabel(/^Username$/i).or(page.locator('#username, input[name="username"]')).first();

export function isLoginUrl(url: string): boolean {
  return /login\.salesforce\.com|\/\?ec=|\/login|secur\/logout/i.test(url);
}

export async function waitForSpinnersToClear(page: Page, timeout = 30_000): Promise<void> {
  const spinner = page.locator('.slds-spinner, lightning-spinner');
  await expect(spinner).toHaveCount(0, { timeout }).catch(() => undefined);
}

export async function waitForLightningReady(page: Page, timeout = 90_000): Promise<void> {
  if (isFrontdoorUrl(page.url())) {
    await page.waitForURL(/\/lightning\//, { timeout, waitUntil: 'domcontentloaded' });
  } else if (isClassicUrl(page.url())) {
    await gotoIgnoringAbort(page, '/lightning/page/home');
  }

  await APP_LAUNCHER(page).first().waitFor({ state: 'visible', timeout });
  await waitForSpinnersToClear(page);
}

export function isFrontdoorUrl(url: string): boolean {
  return /\/secur\/frontdoor\.jsp/i.test(url);
}

export function isClassicUrl(url: string): boolean {
  return /\/home\/home\.jsp/i.test(url);
}

async function gotoIgnoringAbort(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ERR_ABORTED|interrupted|Navigation failed/i.test(message)) {
      throw error;
    }
  }
}

export async function isOnLoginPage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => '');
  if (/Login\s*\|\s*Salesforce/i.test(title) || isLoginUrl(page.url())) {
    return true;
  }

  return LOGIN_USERNAME(page).isVisible().catch(() => false);
}

export async function isLightningAuthenticated(page: Page): Promise<boolean> {
  if (await isOnLoginPage(page)) {
    return false;
  }

  return APP_LAUNCHER(page)
    .first()
    .isVisible()
    .catch(() => false);
}

export async function assertNotOnLoginPage(page: Page): Promise<void> {
  if (await isOnLoginPage(page)) {
    throw new Error(
      'Salesforce session is missing or expired. Tests reuse saved auth state and do not sign in. Run `npm run auth:save` to capture a fresh session after MFA.',
    );
  }
}
