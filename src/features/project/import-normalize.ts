/**
 * Normalizações aplicadas a um projeto recém-importado.
 *
 * Projetos que vêm de fora (ZIP exportado por outra ferramenta, saída do
 * caminho PDF→LaTeX) chegam com formas que o app entende mas que travam a
 * geração do PDF ou escondem campos do wizard. Aqui elas viram a forma
 * canônica, uma única vez, antes de o projeto ser persistido — o arquivo
 * continua sendo a fonte de verdade dali em diante.
 */

import { bytesToText, type Project, textToBytes } from "@papyru/project-model";
import { repairFolhaAprovacao } from "./folha-aprovacao";

/** Reescreve o texto de um arquivo; devolve o projeto original se nada mudou. */
function rewriteFile(
  project: Project,
  path: string,
  transform: (source: string) => string | null,
): Project {
  const index = project.files.findIndex((f) => f.path === path);
  if (index === -1) return project;
  const file = project.files[index];
  if (!file) return project;
  const next = transform(bytesToText(file.bytes));
  if (next === null) return project;
  const files = [...project.files];
  files[index] = { ...file, bytes: textToBytes(next) };
  return { ...project, files };
}

/** Devolve o projeto pronto para persistir (o mesmo objeto se nada mudou). */
export function normalizeImportedProject(project: Project): Project {
  return rewriteFile(project, project.entry, repairFolhaAprovacao);
}
