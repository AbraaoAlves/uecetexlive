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

function templateFiles(): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  collect(TEMPLATE_ROOT, files);
  return files;
}

const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);
const encode = (text: string) => new TextEncoder().encode(text);

export const RESUMO_BODY = "Este trabalho comparou plataformas de correção automática.";
export const RESUMO_KEYWORDS = "ensino; correção automática; sobrecarga.";
export const ABSTRACT_BODY = "This work compared automatic grading platforms.";
export const ABSTRACT_KEYWORDS = "teaching; automatic grading; overload.";

/**
 * ZIP com resumo e abstract na forma que sai do caminho PDF→LaTeX: o rótulo
 * "Palavras-chave:"/"Keywords:" como texto corrido, sem a macro que o wizard
 * procura. Texto sintético.
 */
export function makeLiteralResumoZip(): Uint8Array {
  const files = templateFiles();
  files["elementos-pre-textuais/resumo.tex"] = encode(
    `${RESUMO_BODY} Palavras-chave: ${RESUMO_KEYWORDS}\n`,
  );
  files["elementos-pre-textuais/abstract.tex"] = encode(
    `${ABSTRACT_BODY} Keywords: ${ABSTRACT_KEYWORDS}\n`,
  );
  return zipSync(files);
}

/**
 * ZIP de um projeto "vindo de fora": o modelo vendorado com as duas marcas do
 * caminho PDF→LaTeX que travavam a geração do PDF — trabalho de graduação (a
 * folha de aprovação que junta três linhas por assinatura) e um centro de
 * membro da banca em branco. Sem nenhum byte de trabalho real.
 */
export function makeEmittedProjectZip(): Uint8Array {
  const files = templateFiles();

  const entry = decode(files["documento.tex"]);
  const patched = entry
    .replace("%\\trabalhoacademico{tccgraduacao}", "\\trabalhoacademico{tccgraduacao}")
    .replace("\\trabalhoacademico{dissertacao}", "%\\trabalhoacademico{dissertacao}")
    .replace(/\\membrodabancadoiscentro\{[^}]*\}/, "\\membrodabancadoiscentro{}");
  if (patched === entry) throw new Error("modelo mudou: os patches do fixture não casam");
  files["documento.tex"] = encode(patched);

  return zipSync(files);
}

/** ZIP do modelo com uma página opcional já desligada no documento. */
export function makeToggledOffZip(macro: string): Uint8Array {
  const files = templateFiles();
  const entry = decode(files["documento.tex"]);
  const patched = entry.replace(
    new RegExp(`^([ \\t]*)(\\\\${macro}(?:\\{[^}]*\\})?)[ \\t]*$`, "m"),
    "$1%$2",
  );
  if (patched === entry) throw new Error(`modelo não tem a linha \\${macro}`);
  files["documento.tex"] = encode(patched);
  return zipSync(files);
}
