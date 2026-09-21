import { type Locator, type Page } from '@playwright/test';
import { waitForSpinnersToClear } from '../utils/lightning';

export class AppLauncher {
  readonly button: Locator;
  readonly searchInput: Locator;
  readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.button = page
      .getByRole('button', { name: 'App Launcher' })
      .or(page.locator('one-app-launcher-header button, button.slds-icon-waffle_container'));
    this.searchInput = page.getByRole('combobox', { name: /Search apps and items/i });
    this.panel = page.locator('one-app-launcher-menu, one-app-launcher-modal');
  }

  async open(): Promise<void> {
    await this.button.first().click();
    await waitForSpinnersToClear(this.page);
    await this.searchInput.first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  async search(term: string): Promise<void> {
    const input = this.searchInput.first();
    await input.fill(term);
    await waitForSpinnersToClear(this.page);
  }

  result(appName: string): Locator {
    return this.panel.getByText(appName, { exact: true }).first();
  }
}
