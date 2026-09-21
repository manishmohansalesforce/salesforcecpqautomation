import { type Locator, type Page } from '@playwright/test';
import { env } from '../config/env';
import {
  isLightningAuthenticated,
  isOnLoginPage,
  waitForLightningReady,
} from './lightning';

export type AuthOptions = {
  headed: boolean;
  allowManualMfa: boolean;
};

const MANUAL_MFA_TIMEOUT_MS = 5 * 60_000;

export async function authenticateSalesforce(page: Page, options: AuthOptions): Promise<void> {
  await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });

  const username = page.getByLabel(/^Username$/i).or(page.locator('#username, input[name="username"]')).first();
  const appLauncher = page
    .getByRole('button', { name: 'App Launcher' })
    .or(page.locator('one-app-launcher-header button, button.slds-icon-waffle_container'));

  await username.or(appLauncher).first().waitFor({ state: 'visible', timeout: 60_000 });

  if (await isLightningAuthenticated(page)) {
    await waitForLightningReady(page);
    return;
  }

  if (await isOnLoginPage(page)) {
    await completeLoginForm(page, options);
  }

  await completeMfaIfPresent(page, options);
  await waitForLightningReady(page, options.allowManualMfa ? MANUAL_MFA_TIMEOUT_MS : 90_000);
}

async function completeLoginForm(page: Page, options: AuthOptions): Promise<void> {
  const switchUser = page.getByRole('button', { name: /Log In with a Different Username/i }).or(
    page.getByRole('link', { name: /Log In with a Different Username/i }),
  );
  if (await switchUser.first().isVisible().catch(() => false)) {
    await switchUser.first().click();
  }

  const username = page.getByLabel(/^Username$/i).or(page.locator('#username, input[name="username"]')).first();
  const password = page.getByLabel(/^Password$/i).or(page.locator('#password, input[name="pw"]')).first();
  const loginButton = page.locator('#Login').or(page.getByRole('button', { name: /Log In/i }));

  if (env.username && env.password) {
    await username.fill(env.username);

    if (!(await password.isVisible().catch(() => false))) {
      await loginButton.first().click();
      await password.waitFor({ state: 'visible', timeout: 15_000 });
    }

    await password.fill(env.password);
    await loginButton.first().click();
    return;
  }

  if (options.allowManualMfa) {
    console.log(
      '\n[auth] Complete Salesforce login (and MFA if prompted) in the opened browser.\n' +
        '[auth] Waiting up to 5 minutes for Lightning home...\n',
    );
    return;
  }

  throw new Error(missingCredentialsMessage());
}

async function completeMfaIfPresent(page: Page, options: AuthOptions): Promise<void> {
  const appLauncher = page.getByRole('button', { name: 'App Launcher' });
  const totpInput = page
    .locator('#tc, input[name="totp"], input[name="emc"]')
    .or(page.getByLabel(/Verification Code/i));
  const identityChallenge = page.getByText(
    /Verify Your Identity|Salesforce Authenticator|Check your Salesforce Authenticator|Enter the verification code/i,
  );
  const loginError = page.locator('#error, .loginError');

  await appLauncher
    .or(totpInput)
    .or(identityChallenge)
    .or(loginError)
    .first()
    .waitFor({ state: 'visible', timeout: options.allowManualMfa ? MANUAL_MFA_TIMEOUT_MS : 90_000 })
    .catch(() => undefined);

  if (await loginError.first().isVisible().catch(() => false)) {
    const message = (await loginError.first().innerText().catch(() => '')).trim();
    throw new Error(`Salesforce login failed${message ? `: ${message}` : '.'}`);
  }

  if (await appLauncher.isVisible().catch(() => false)) {
    return;
  }

  const mfaVisible =
    (await totpInput.first().isVisible().catch(() => false)) ||
    (await identityChallenge.first().isVisible().catch(() => false));

  if (!mfaVisible) {
    return;
  }

  if (env.mfaSecret) {
    await submitTotp(page, totpInput.first());
    return;
  }

  if (options.allowManualMfa) {
    console.log(
      '\n[auth] MFA challenge detected. Approve it in the browser. Waiting up to 5 minutes...\n',
    );
    return;
  }

  throw new Error(missingMfaSecretMessage());
}

async function submitTotp(page: Page, totpInput: Locator): Promise<void> {
  const useCode = page.getByRole('link', {
    name: /verification code|Use a verification code|Choose Another Verification Method/i,
  });

  if (!(await totpInput.isVisible().catch(() => false)) && (await useCode.first().isVisible().catch(() => false))) {
    await useCode.first().click();
    await totpInput.waitFor({ state: 'visible', timeout: 15_000 });
  }

  const { generateSync } = await import('otplib');
  const token = generateSync({ secret: env.mfaSecret });
  await totpInput.fill(token);

  const remember = page
    .getByLabel(/Don't ask again|Remember this browser|Remember verification/i)
    .or(page.locator('#save[type="checkbox"]'));
  if (await remember.first().isVisible().catch(() => false)) {
    await remember.first().check({ force: true }).catch(() => undefined);
  }

  await page.getByRole('button', { name: /Verify|Continue/i }).first().click();
}

function missingCredentialsMessage(): string {
  if (process.env.CI) {
    return (
      'CI cannot complete a mobile OTP. Set GitHub Actions secret SF_AUTH_URL from `sf org login web` (OTP once on your phone) then `npm run auth:url`. ' +
      'Setup refreshes that token and opens Lightning via frontdoor.jsp. Do not commit playwright/.auth/salesforce.json.'
    );
  }

  return (
    'No saved auth state. Run `npm run auth:save` and complete the mobile OTP in the headed browser, or set SF_AUTH_URL from `npm run auth:url`.'
  );
}

function missingMfaSecretMessage(): string {
  if (process.env.CI) {
    return (
      'Salesforce sent an OTP to mobile. CI cannot read that. Use SF_AUTH_URL (refresh token from `sf org login web`) instead of username/password in GitHub Actions.'
    );
  }

  return (
    'Salesforce sent an OTP to your phone. Complete it in the headed browser (`npm run auth:save`), or set SF_AUTH_URL so setup can skip the login page.'
  );
}
