import { type Page } from '@playwright/test';
import { waitForSpinnersToClear } from '../utils/lightning';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async waitForPageIdle(): Promise<void> {
    await waitForSpinnersToClear(this.page);
  }
}
