import { expect, test } from "@playwright/test";
import { waitForAppShellPrecache } from "./helpers";

/**
 * D12: the service worker must deliver the big busytex binaries byte-perfect
 * in both layouts — with gzip sidecars (production Pages deploy, decompressed
 * client-side) and without them (dev/preview/CI serve the raw vendored
 * files). Fetches the smallest .data package so the check stays light — no
 * engine boot, no compile.
 */
test("service worker serves busytex .data byte-perfect (sidecar or raw)", async ({
  page,
}) => {
  await page.goto("/");
  await waitForAppShellPrecache(page);

  const result = await page.evaluate(async () => {
    const manifest = (await (await fetch("/wasm/busytex/manifest.json")).json()) as {
      files: { name: string; size: number }[];
    };
    const target = manifest.files
      .filter((f) => f.name.endsWith(".data"))
      .sort((a, b) => a.size - b.size)[0];
    if (!target) return null;
    const res = await fetch(`/wasm/busytex/${target.name}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { name: target.name, expected: target.size, got: bytes.byteLength };
  });

  expect(result).not.toBeNull();
  expect(result?.got, `${result?.name} deve chegar byte-perfeito`).toBe(result?.expected);
});
