import { type Page } from '@playwright/test';
import { assertNotOnLoginPage, waitForLightningReady } from '../utils/lightning';
import { AppLauncher } from './AppLauncher';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly appLauncher: AppLauncher;

  constructor(page: Page) {
    super(page);
    this.appLauncher = new AppLauncher(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/lightning/page/home', { waitUntil: 'domcontentloaded' });
    await assertNotOnLoginPage(this.page);
    await waitForLightningReady(this.page);
  }

  async openAppLauncher(): Promise<void> {
    await this.appLauncher.open();
  }
}
