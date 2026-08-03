import { expect, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

test("as abas do rail alternam arquivos e conformidade pelo teclado", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  const filesTab = page.getByTestId("rail-tab-files");
  const complianceTab = page.getByTestId("rail-tab-compliance");

  await expect(filesTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("project-files-panel")).toBeVisible();

  const filesPanelId = await filesTab.getAttribute("aria-controls");
  expect(filesPanelId).toBeTruthy();
  await expect(page.locator(`[id="${filesPanelId}"]`)).toBeVisible();

  await filesTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(complianceTab).toBeFocused();
  await expect(complianceTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("compliance-rail-panel")).toBeVisible();
  await expect(page.getByTestId("project-files-panel")).not.toBeVisible();

  const compliancePanelId = await complianceTab.getAttribute("aria-controls");
  expect(compliancePanelId).toBeTruthy();
  await expect(page.locator(`[id="${compliancePanelId}"]`)).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(filesTab).toBeFocused();
  await expect(filesTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("project-files-panel")).toBeVisible();
});
