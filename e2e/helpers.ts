import type { Page } from "@playwright/test";

/**
 * A fresh IndexedDB profile shows the first-run metadata welcome dialog
 * (F2) over the shell — dismiss it so tests can interact with the app.
 */
export async function dismissWelcome(page: Page): Promise<void> {
  await page.getByTestId("welcome-later").click();
}
