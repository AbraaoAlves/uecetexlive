/**
 * Project model schemas (§5.1). Every IndexedDB read passes through
 * ProjectSchema.parse — corrupt/legacy state falls back to re-seeding.
 */
import { z } from "zod";

export const FileKindSchema = z.enum([
  "tex",
  "bib",
  "bst",
  "sty",
  "cls",
  "image",
  "pdf",
  "code",
  "other",
]);
export type FileKind = z.infer<typeof FileKindSchema>;

const SafePath = z
  .string()
  .regex(/^[\w\-./]+$/)
  .refine((p) => !p.includes(".."), "no path traversal")
  .refine((p) => !p.startsWith("/"), "no absolute paths");

export const ProjectFileSchema = z.object({
  path: SafePath,
  // z.custom instead of z.instanceof: keeps the inferred type as plain
  // Uint8Array (instanceof infers Uint8Array<ArrayBuffer>, which rejects
  // TextEncoder output typed over ArrayBufferLike).
  bytes: z.custom<Uint8Array>((v) => v instanceof Uint8Array, "expected Uint8Array"),
  kind: FileKindSchema,
  /** WYSIWYG-eligible (§4.1). false for lib/, documento.tex, non-prose. */
  editable: z.boolean(),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  entry: z.string(),
  templateSource: z.url(),
  /**
   * Commit the project was seeded from (TemplateManifestSchema.commit).
   * Optional so records saved before this field existed keep parsing —
   * absence just means "unknown baseline", never a validation failure.
   * Lets the app detect "the bundled template moved on" without ever
   * touching `files` automatically (§ update-notice banner).
   */
  templateCommit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  files: z.array(ProjectFileSchema),
  updatedAt: z.number(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CompileSettingsSchema = z.object({
  mode: z.enum(["draft", "full"]).default("draft"),
  autoCompile: z.boolean().default(false),
});
export type CompileSettings = z.infer<typeof CompileSettingsSchema>;

export const UiSettingsSchema = z.object({
  /** "Avançado" toggle — unlocks documento.tex/lib and shows structural files. */
  advancedMode: z.boolean().default(false),
  railCollapsed: z.boolean().default(false),
  /** Rail sections the student folded (RailSection names, e.g. "chapters"). */
  collapsedSections: z.array(z.string()).default([]),
  /** First-run metadata wizard already shown/dismissed. */
  welcomeSeen: z.boolean().default(false),
  /**
   * Last template commit the "modelo atualizado" banner was dismissed for
   * (null = never dismissed). Keyed by commit so a later template update
   * makes the banner reappear instead of staying dismissed forever.
   */
  dismissedTemplateCommit: z.string().nullable().default(null),
  /** Color theme; "system" follows the OS preference. */
  theme: z.enum(["system", "light", "dark"]).default("system"),
  /** Which tab the rail shows (ADR-03/5.10 — Referências reuses the existing rail, not a separate panel). */
  railTab: z.enum(["files", "references"]).default("files"),
  /** Lifetime app-boot count (3.5 — backup reminder cadence). Never decreases. */
  sessionCount: z.number().int().nonnegative().default(0),
  /** Lifetime milliseconds the app was open+visible (3.5). Never decreases. */
  cumulativeEditMs: z.number().nonnegative().default(0),
  /** sessionCount/cumulativeEditMs at the last export or reminder dismissal — the reminder fires N sessions or M minutes past this baseline. */
  backupReminderBaselineSession: z.number().int().nonnegative().default(0),
  backupReminderBaselineEditMs: z.number().nonnegative().default(0),
});
export type UiSettings = z.infer<typeof UiSettingsSchema>;

/** Shape written by scripts/vendor-uecetex2.sh (§5.5). */
export const TemplateManifestSchema = z.object({
  name: z.string(),
  entry: z.string(),
  source: z.url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  files: z.array(
    z.object({
      path: SafePath,
      size: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
});
export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;
