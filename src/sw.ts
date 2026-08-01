/**
 * Service worker (injectManifest — DEVIATIONS.md D12).
 *
 * Replicates the old generateSW behavior (app-shell precache, /wasm +
 * /templates runtime CacheFirst) and adds one twist for hosts that cannot
 * compress large binaries (GitHub Pages serves .data/.wasm uncompressed,
 * with no header control): the deploy publishes gzip sidecars (`file.gz`,
 * scripts/precompress-wasm.sh) and this worker fetches the sidecar,
 * decompresses it with DecompressionStream and caches the *decompressed*
 * bytes under the original URL — 218.8 MB shrink to 146.5 MB on the wire.
 * When the sidecar is absent (dev/preview/CI serve the raw vendored files)
 * the fetch falls back to the original URL, so both layouts work.
 */
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

void self.skipWaiting();
clientsClaim();

// App shell only — the WASM/TeX payload is runtime-cached below (§11.3).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// "/" in dev/preview/e2e; "/uecetexlive/" on the GitHub project page —
// inlined at build time, so every route below is subpath-aware.
const BASE = import.meta.env.BASE_URL;

// Storybook is deployed as a sibling static site under the SW's scope
// (${BASE}storybook/) — without the denylist entry, offline navigations to
// it would be hijacked into the app shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), {
    denylist: [
      new RegExp(`^${BASE}wasm/`),
      new RegExp(`^${BASE}templates/`),
      new RegExp(`^${BASE}storybook/`),
    ],
  }),
);

// Versioned with a hash of public/wasm + public/templates (src/build/vendor-hash.ts,
// vite.config.ts) so a deploy that changes the vendored LaTeX engines/template
// gets a FRESH cache bucket instead of silently reusing (and never refetching)
// whatever CacheFirst already stored under the old, unversioned name. The
// activate handler below evicts old vendor buckets once this one is current.
const CACHE_PREFIX = "uecetex-assets-";
const CACHE_NAME = `${CACHE_PREFIX}${import.meta.env.VITE_VENDOR_HASH}`;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

/** The big busytex binaries that ship with a gzip sidecar in production. */
const GZ_SIDECAR = /\/wasm\/busytex\/[^/]+\.(?:data|wasm)$/;

const contentTypeFor = (url: string) =>
  url.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";

/**
 * Rewrites the fetch to `${url}.gz` and undoes the gzip before the response
 * reaches the cache/page. Composes with CacheFirst: the cache key stays the
 * original URL, so cache hits never touch this plugin again.
 */
const gzipSidecarPlugin = {
  requestWillFetch: async ({ request }: { request: Request }) =>
    new Request(`${request.url}.gz`, { credentials: request.credentials }),

  fetchDidSucceed: async ({
    request,
    response,
  }: {
    request: Request;
    response: Response;
  }): Promise<Response> => {
    const rawUrl = request.url.replace(/\.gz$/, "");
    const contentType = response.headers.get("content-type") ?? "";
    // SPA-fallback hosts answer missing files with the HTML shell, HTTP 200
    // (the D7 lesson) — treat that as "no sidecar" too.
    if (!response.ok || contentType.includes("text/html")) {
      return fetch(rawUrl);
    }
    if (!response.body) return fetch(rawUrl);

    // Peek the magic bytes: if a host transparently content-decoded the
    // sidecar, the body is already the original file — pass it through.
    const [probe, body] = response.body.tee();
    const reader = probe.getReader();
    const { value: head } = await reader.read();
    void reader.cancel();
    const isGzip = head !== undefined && head[0] === 0x1f && head[1] === 0x8b;
    const bytes = isGzip ? body.pipeThrough(new DecompressionStream("gzip")) : body;
    return new Response(bytes, {
      status: 200,
      headers: { "Content-Type": contentTypeFor(rawUrl) },
    });
  },
};

// Order matters: the sidecar route must win over the generic /wasm route.
registerRoute(
  ({ url }) => GZ_SIDECAR.test(url.pathname),
  new CacheFirst({
    cacheName: CACHE_NAME,
    plugins: [
      gzipSidecarPlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 6000 }),
    ],
  }),
);

registerRoute(
  // Path-segment match covers both "/" and subpath deploys. `assets/*.wasm` é
  // o leitor de PDF, que o bundler versiona no diretório de assets: sem esta
  // rota, quem ficou offline depois do primeiro acesso não conseguiria
  // importar um PDF (o .wasm não entra no precache de propósito — são 10 MB).
  ({ url }) =>
    /\/(wasm|templates)\//.test(url.pathname) || url.pathname.endsWith(".wasm"),
  new CacheFirst({
    cacheName: CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 6000 }),
      new RangeRequestsPlugin(),
    ],
  }),
);
