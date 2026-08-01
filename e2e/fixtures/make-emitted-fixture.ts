import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = join(__dirname, "../../public/templates/uecetex2/files");

function collect(dir: string, out: Record<string, Uint8Array>): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, out);
    else out[relative(TEMPLATE_ROOT, path)] = new Uint8Array(readFileSync(path));
  }
}

/**
 * ZIP de um projeto "vindo de fora": o modelo vendorado com as duas marcas do
 * caminho PDF→LaTeX que travavam a geração do PDF — trabalho de graduação (a
 * folha de aprovação que junta três linhas por assinatura) e um centro de
 * membro da banca em branco. Sem nenhum byte de trabalho real.
 */
export function makeEmittedProjectZip(): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  collect(TEMPLATE_ROOT, files);

  const entry = new TextDecoder().decode(files["documento.tex"]);
  const patched = entry
    .replace("%\\trabalhoacademico{tccgraduacao}", "\\trabalhoacademico{tccgraduacao}")
    .replace("\\trabalhoacademico{dissertacao}", "%\\trabalhoacademico{dissertacao}")
    .replace(/\\membrodabancadoiscentro\{[^}]*\}/, "\\membrodabancadoiscentro{}");
  if (patched === entry) throw new Error("modelo mudou: os patches do fixture não casam");
  files["documento.tex"] = new TextEncoder().encode(patched);

  return zipSync(files);
}
