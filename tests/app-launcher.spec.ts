import { APPS } from '../src/config/apps';
import { expect, test } from '../src/fixtures/test';

test.describe('Salesforce App Launcher', () => {
  test('shows Salesforce CPQ in the 9-dot App Launcher', async ({ homePage, appLauncher }) => {
    await homePage.goto();
    await homePage.openAppLauncher();
    await appLauncher.search(APPS.CPQ);

    await expect(appLauncher.result(APPS.CPQ), 'Salesforce CPQ should be listed in App Launcher').toBeVisible();
  });
});
