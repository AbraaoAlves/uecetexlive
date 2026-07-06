/**
 * Adapter do app: template uecetex2 servido dos assets estáticos do Vite.
 * O import.meta.env fica aqui — o pacote recebe a base URL como argumento.
 */
import {
  fetchTemplateManifest as fetchManifestFromBase,
  type Project,
  seedTemplate as seedFromManifest,
  type TemplateManifest,
  UECETEX2_STRUCTURE,
} from "@papyru/project-model";

// BASE_URL-prefixed: subpath deploys (GitHub Pages) serve templates under it.
const TEMPLATE_BASE = `${import.meta.env.BASE_URL}templates/uecetex2`;

export function seedTemplate(): Promise<Project> {
  return seedFromManifest({
    templateBaseUrl: TEMPLATE_BASE,
    structure: UECETEX2_STRUCTURE,
  });
}

export function fetchTemplateManifest(): Promise<TemplateManifest> {
  return fetchManifestFromBase(TEMPLATE_BASE);
}
