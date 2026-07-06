/**
 * UeceTexLive busytex worker (§3.3) — a classic worker (importScripts is
 * required by the Emscripten glue + LZ4 data loaders, which expect the
 * BusytexPipeline global as their Module shim; see docs/busytex-integration.md).
 *
 * It reuses the reference BusytexPipeline for module init / package mounting
 * (proven code — §0.4), but the pass sequencing lives page-side in
 * src/features/compiler/orchestrator.ts. This worker only exposes primitives:
 *
 *   init         {base, dataPackages[]}  → {versions}
 *   writeProject {files:[{path,bytes}]}  → {}
 *   exec         {argv[]}                → {exitCode, stdout, stderr}
 *   readText     {path}                  → {text|null}
 *   readBytes    {path}                  → {bytes|null}
 *
 * Re-entrancy: one Module instance; the wasm heap is snapshot after init and
 * restored after every exec (upstream's reset pattern, busytex_pipeline.js).
 */

/* global BusytexPipeline, importScripts */

importScripts("busytex_pipeline.js");

let pipeline = null;
let memHeader = null;
// Tree pdftex.map + vendored ectt lines; written into every project cwd
// (TEXFONTMAPS searches $TEXMFDOTDIR first — see scripts/vendor-busytex.sh).
let mergedFontMap = null;

const TREE_PDFTEX_MAP = "/texlive/texmf-dist/texmf-var/fonts/map/pdftex/updmap/pdftex.map";

async function getModule() {
  const module = await pipeline.Module;
  if (!module) throw new Error("busytex Module not initialized");
  return module;
}

async function handleInit({ base, dataPackages, mapAppend }) {
  const dataPackagesJs = dataPackages.map((name) => base + name);
  let versions = null;
  const initialized = new Promise((resolve) => {
    pipeline = new BusytexPipeline(
      `${base}busytex.js`,
      `${base}busytex.wasm`,
      dataPackagesJs,
      dataPackagesJs, // preload all — we always need the full set for abnTeX2
      [], // texmf_local
      (msg) => postMessage({ kind: "print", msg: String(msg) }),
      (appletVersions) => {
        versions = appletVersions;
        resolve();
      },
      true, // preload: keep the Module alive between compiles
      BusytexPipeline.ScriptLoaderWorker,
    );
  });
  await initialized;
  const module = await getModule();
  // Heap snapshot for the per-exec reset (see file header).
  memHeader = Uint8Array.from(module.HEAPU8.slice(0, pipeline.mem_header_size));

  if (mapAppend) {
    const { FS } = module;
    if (FS.analyzePath(TREE_PDFTEX_MAP).exists) {
      const treeMap = FS.readFile(TREE_PDFTEX_MAP, { encoding: "utf8" });
      mergedFontMap = `${treeMap}\n${mapAppend}`;
    } else {
      postMessage({ kind: "print", msg: `tree map not found at ${TREE_PDFTEX_MAP}` });
      mergedFontMap = null;
    }
  }
  return { versions };
}

async function handleWriteProject({ files }) {
  const module = await getModule();
  const { FS, PATH } = module;
  const projectDir = pipeline.project_dir;

  const analyzed = FS.analyzePath(projectDir);
  if (
    analyzed.exists &&
    analyzed.object &&
    analyzed.object.mount &&
    analyzed.object.mount.mountpoint === projectDir
  ) {
    FS.unmount(projectDir);
  }
  FS.mount(FS.filesystems.MEMFS, {}, projectDir);

  const dirs = new Set(["/", projectDir]);
  const mkdirp = (dirpath) => {
    if (dirs.has(dirpath)) return;
    mkdirp(PATH.dirname(dirpath));
    FS.mkdir(dirpath);
    dirs.add(dirpath);
  };

  let userProvidedMap = false;
  for (const { path, bytes } of files) {
    if (path === "pdftex.map") userProvidedMap = true;
    const absolute = PATH.join(projectDir, path);
    mkdirp(PATH.dirname(absolute));
    FS.writeFile(absolute, new Uint8Array(bytes));
  }
  if (mergedFontMap && !userProvidedMap) {
    FS.writeFile(PATH.join(projectDir, "pdftex.map"), mergedFontMap);
  }
  FS.chdir(projectDir);
  return {};
}

async function handleExec({ argv }) {
  const module = await getModule();
  const result = module.callMainWithRedirects(argv, false);
  // Restore the heap so the next callMain sees a pristine runtime.
  module.HEAPU8.fill(0);
  module.HEAPU8.set(memHeader);
  return {
    exitCode: result.exit_code | 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

async function handleReadText({ path }) {
  const module = await getModule();
  const { FS, PATH } = module;
  const absolute = PATH.join(pipeline.project_dir, path);
  if (!FS.analyzePath(absolute).exists) return { text: null };
  return { text: FS.readFile(absolute, { encoding: "utf8" }) };
}

async function handleReadBytes({ path }) {
  const module = await getModule();
  const { FS, PATH } = module;
  const absolute = PATH.join(pipeline.project_dir, path);
  if (!FS.analyzePath(absolute).exists) return { bytes: null };
  const bytes = FS.readFile(absolute, { encoding: "binary" });
  return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

async function handleWriteFile({ path, bytes }) {
  const module = await getModule();
  const { FS, PATH } = module;
  FS.writeFile(PATH.join(pipeline.project_dir, path), new Uint8Array(bytes));
  return {};
}

const handlers = {
  init: handleInit,
  writeProject: handleWriteProject,
  exec: handleExec,
  readText: handleReadText,
  readBytes: handleReadBytes,
  writeFile: handleWriteFile,
};

onmessage = async ({ data }) => {
  const { id, cmd } = data;
  const handler = handlers[cmd];
  if (!handler) {
    postMessage({ id, ok: false, error: `unknown cmd: ${cmd}` });
    return;
  }
  try {
    const result = await handler(data);
    const transfer = result.bytes ? [result.bytes] : [];
    postMessage({ id, ok: true, ...result }, transfer);
  } catch (err) {
    postMessage({
      id,
      ok: false,
      error: `${err}`,
      stack: err && err.stack ? String(err.stack) : undefined,
    });
  }
};
