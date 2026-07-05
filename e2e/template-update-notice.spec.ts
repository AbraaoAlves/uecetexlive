import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { dismissWelcome } from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The SW's CacheFirst route (src/sw.ts) resolves /templates/** straight from
// Cache Storage without a network round-trip, so page.route() below would
// never see the request once it's warm. This spec is about the React-level
// drift banner (store.tsx/useTemplateUpdateNotice), not SW caching — which
// has its own build-time verification (src/build/vendor-hash.test.ts) — so
// disabling the SW here keeps the test deterministic.
test.use({ serviceWorkers: "block" });

const REAL_MANIFEST = JSON.parse(
  readFileSync(join(__dirname, "../public/templates/uecetex2/manifest.json"), "utf-8"),
);

const FAKE_COMMIT_1 = "1111111111111111111111111111111111111111";
const FAKE_COMMIT_2 = "2222222222222222222222222222222222222222";

/** Serves the real manifest with only `commit` swapped — files stay valid. */
async function mockTemplateCommit(page: Page, commit: string): Promise<void> {
  await page.route("**/templates/uecetex2/manifest.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...REAL_MANIFEST, commit }),
    }),
  );
}

const MARKER_PATH = "elementos-textuais/introducao.tex";

async function editAndSave(page: Page, marker: string): Promise<void> {
  await page.getByTestId(`rail-file-${MARKER_PATH}`).click();
  await page.getByTestId("view-toggle").click();
  const editor = page.getByTestId("source-editor-input");
  await editor.click();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(`\n${marker}`);
  await expect(page.getByTestId("save-state")).toHaveAttribute("data-state", "saved");
}

async function assertMarkerPersisted(page: Page, marker: string): Promise<void> {
  await page.getByTestId(`rail-file-${MARKER_PATH}`).click();
  await page.getByTestId("view-toggle").click();
  await expect(page.getByTestId("source-editor-value")).toHaveValue(
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

test("template update surfaces a dismissible, non-destructive banner", async ({
  page,
}) => {
  await page.goto("/");
  await dismissWelcome(page);

  const marker = `% e2e-template-notice-${Date.now()}`;
  await editAndSave(page, marker);

  await mockTemplateCommit(page, FAKE_COMMIT_1);
  await page.reload();

  await expect(page.getByTestId("template-update-banner")).toBeVisible();
  await assertMarkerPersisted(page, marker);

  await page.getByTestId("template-update-dismiss").click();
  await expect(page.getByTestId("template-update-banner")).not.toBeVisible();

  // Same (dismissed) commit — banner stays hidden across a reload.
  await page.reload();
  await expect(page.getByTestId("template-update-banner")).not.toBeVisible();

  // A newer commit — the banner reappears (dismissal is keyed per-commit).
  await mockTemplateCommit(page, FAKE_COMMIT_2);
  await page.reload();
  await expect(page.getByTestId("template-update-banner")).toBeVisible();
});
