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
  const pendingCount = complianceTab.getByTestId("checklist-pending-count");
  await expect(pendingCount).toBeVisible();
  expect(Number(await pendingCount.textContent())).toBeGreaterThan(0);
  await pendingCount.hover();
  await expect(page.getByRole("tooltip")).toContainText("Verificações com pendência:");

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

test("ir para mantém a aba aberta e identifica o item já visitado", async ({ page }) => {
  await page.goto("/");
  await dismissWelcome(page);

  await page.getByTestId("rail-tab-compliance").click();
  const expand = page.getByTestId("compliance-expand-references");
  if ((await expand.getAttribute("aria-expanded")) === "false") await expand.click();

  const goto = page.locator('[data-testid^="compliance-goto-references-"]').first();
  await expect(goto).toBeVisible();
  const gotoId = await goto.getAttribute("data-testid");
  expect(gotoId).toBeTruthy();
  const itemTestId = gotoId?.replace("compliance-goto-", "compliance-item-");
  const visitedTestId = gotoId?.replace("compliance-goto-", "compliance-item-visited-");

  await goto.click();

  await expect(page.getByTestId("rail-tab-compliance")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("compliance-rail-panel")).toBeVisible();
  await expect(page.getByTestId(itemTestId ?? "")).toHaveAttribute(
    "data-visited",
    "true",
  );
  await expect(page.getByTestId(visitedTestId ?? "")).toBeVisible();
  await expect(
    page.getByTestId("editor-pane").getByTestId("references-panel"),
  ).toBeVisible();
});
