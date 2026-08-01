/**
 * O núcleo vendorado bate com o manifesto?
 *
 * Substitui o `tsc --noEmit` habitual dos pacotes: este código é verificado no
 * repositório de origem (que compila com `strict` e roda a suíte antes de cada
 * commit). O que importa aqui é outra coisa — que ninguém tenha editado a cópia
 * local, porque a edição se perderia na próxima vendorização.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
  commit: string;
  files: { path: string; size: number; sha256: string }[];
};

const drifted: string[] = [];
for (const file of manifest.files) {
  const bytes = readFileSync(join(root, "src", file.path));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== file.sha256) drifted.push(file.path);
}

if (drifted.length > 0) {
  console.error(
    `núcleo vendorado editado localmente: ${drifted.join(", ")}\n` +
      "corrija na origem e rode scripts/vendor-inverse-core.sh de novo.",
  );
  process.exit(1);
}
console.log(
  `inverse-core: ${manifest.files.length} arquivos batem com ${manifest.commit.slice(0, 8)}`,
);
