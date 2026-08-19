/** Gerenciador dos PDFs institucionais e demais arquivos anexos do projeto. */

import { PdfPane } from "@papyru/editor/preview";
import {
  Code2,
  Eye,
  FileImage,
  FileText,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SIGNED_APPROVAL_PATH } from "@/features/project/signed-approval";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export const FICHA_PATH = "elementos-pre-textuais/ficha-catalografica.pdf";

/** Tamanho da ficha de exemplo; o manifesto vendorado tem um teste-sentinela. */
export const TEMPLATE_FICHA_BYTES = 175_366;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_INSTITUTIONAL_PDF_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "pdf",
  "cpp",
  "c",
  "h",
  "java",
  "py",
  "js",
  "ts",
] as const;
const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");
const PDF_MAGIC = "%PDF-";

export interface AttachmentItem {
  path: string;
  sizeBytes: number;
  kind: "image" | "pdf" | "code";
  /** Bytes originais do VFS, usados somente no visualizador local. */
  bytes: Uint8Array;
}

export interface AttachmentUpload {
  name: string;
  bytes: Uint8Array;
}

export interface AttachmentsStepProps {
  attachments: readonly AttachmentItem[];
  onAdd: (uploads: readonly AttachmentUpload[]) => void;
  onReplace: (path: string, upload: AttachmentUpload) => void;
  onDelete: (path: string) => void;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** `null` quando o arquivo pode entrar no projeto; senão, a razão para a UI. */
export function rejectAttachment(
  name: string,
  bytes: Uint8Array,
  options: { pdfOnly?: boolean; expectedExtension?: string } = {},
): string | null {
  const ext = extensionOf(name);
  const allowed = options.pdfOnly
    ? ext === "pdf"
    : ATTACHMENT_EXTENSIONS.includes(ext as never);
  if (!allowed)
    return options.pdfOnly
      ? strings.attachments.pdfTypeError
      : strings.attachments.typeError;
  if (options.expectedExtension && ext !== options.expectedExtension) {
    return strings.attachments.sameTypeError.replace(
      "{extension}",
      options.expectedExtension,
    );
  }
  if (bytes.length === 0) return strings.attachments.emptyError;
  const max = options.pdfOnly ? MAX_INSTITUTIONAL_PDF_BYTES : MAX_ATTACHMENT_BYTES;
  if (bytes.length > max) {
    return options.pdfOnly
      ? strings.attachments.pdfSizeError
      : strings.attachments.sizeError;
  }
  if (ext === "pdf") {
    const head = new TextDecoder().decode(bytes.slice(0, PDF_MAGIC.length));
    if (head !== PDF_MAGIC) return strings.attachments.pdfTypeError;
  }
  return null;
}

async function asUpload(file: File): Promise<AttachmentUpload> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function iconFor(kind: AttachmentItem["kind"]) {
  if (kind === "image") return <FileImage className="size-4 shrink-0" />;
  if (kind === "code") return <Code2 className="size-4 shrink-0" />;
  return <FileText className="size-4 shrink-0" />;
}

function ReplaceButton({
  item,
  onReplace,
  onSelect,
  onError,
}: {
  item: AttachmentItem;
  onReplace: AttachmentsStepProps["onReplace"];
  onSelect: () => void;
  onError: (error: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ext = extensionOf(item.path);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={`.${ext}`}
        className="hidden"
        data-testid={`attachment-replace-input-${item.path}`}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (file.size > MAX_ATTACHMENT_BYTES) {
            onError(strings.attachments.sizeError);
            return;
          }
          const upload = await asUpload(file);
          const problem = rejectAttachment(upload.name, upload.bytes, {
            expectedExtension: ext,
          });
          onError(problem);
          if (!problem) {
            onReplace(item.path, upload);
            onSelect();
          }
        }}
      />
      <button
        type="button"
        className="rounded p-1.5 text-ink-muted hover:bg-accent-soft hover:text-ink"
        aria-label={`${strings.attachments.replace} ${baseName(item.path)}`}
        data-testid={`attachment-replace-${item.path}`}
        onClick={() => inputRef.current?.click()}
      >
        <RefreshCw className="size-3.5" />
      </button>
    </>
  );
}

function InstitutionalCard({
  title,
  description,
  item,
  template = false,
  testId,
  selected,
  onSelect,
  onReplace,
  onDelete,
  onError,
}: {
  title: string;
  description: string;
  item?: AttachmentItem;
  template?: boolean;
  testId: "ficha" | "aprovacao";
  selected: boolean;
  onSelect: () => void;
  onReplace: AttachmentsStepProps["onReplace"];
  onDelete: AttachmentsStepProps["onDelete"];
  onError: (error: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const path = testId === "ficha" ? FICHA_PATH : SIGNED_APPROVAL_PATH;
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        selected && "border-accent bg-accent-soft/30",
      )}
      data-testid={`attachment-card-${testId}`}
      data-selected={selected || undefined}
    >
      <button
        type="button"
        disabled={!item}
        aria-pressed={item ? selected : undefined}
        data-testid={`attachment-select-${testId}`}
        onClick={onSelect}
        className="flex w-full gap-3 text-left disabled:cursor-default"
      >
        <FileText className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm">{title}</h3>
          <p className="mt-1 text-ink-muted text-xs">{description}</p>
          <p className="mt-2 text-xs" data-testid={`attachment-state-${testId}`}>
            {item
              ? template
                ? strings.attachments.templateFile
                : `${strings.attachments.sent} · ${formatSize(item.sizeBytes)}`
              : strings.attachments.notSent}
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        data-testid={`attachment-input-${testId}`}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (file.size > MAX_INSTITUTIONAL_PDF_BYTES) {
            onError(strings.attachments.pdfSizeError);
            return;
          }
          const upload = await asUpload(file);
          const problem = rejectAttachment(upload.name, upload.bytes, { pdfOnly: true });
          onError(problem);
          if (!problem) {
            onReplace(path, upload);
            onSelect();
          }
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`attachment-upload-${testId}`}
          onClick={() => inputRef.current?.click()}
          className="rounded border px-3 py-1.5 text-xs hover:bg-accent-soft"
        >
          {item ? strings.attachments.replace : strings.attachments.sendPdf}
        </button>
        {item && (
          <button
            type="button"
            data-testid={`attachment-delete-${testId}`}
            onClick={() => {
              if (
                window.confirm(strings.attachments.confirmDelete.replace("{name}", title))
              ) {
                onDelete(path);
              }
            }}
            className="rounded px-3 py-1.5 text-danger text-xs hover:bg-danger/10"
          >
            {strings.attachments.remove}
          </button>
        )}
      </div>
    </div>
  );
}

const MAX_CODE_PREVIEW_BYTES = 100 * 1024;

function ImageAttachmentPreview({ item }: { item: AttachmentItem }) {
  const url = useMemo(() => {
    const ext = extensionOf(item.path);
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const copy = new Uint8Array(item.bytes);
    return URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer], { type: mime }));
  }, [item.bytes, item.path]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-ink/5 p-4">
      <img
        src={url}
        alt={baseName(item.path)}
        className="max-h-full max-w-full rounded shadow"
        data-testid="attachment-preview-image"
      />
    </div>
  );
}

function AttachmentPreview({ item }: { item?: AttachmentItem }) {
  if (!item) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-ink-subtle text-sm"
        data-testid="attachment-preview-empty"
      >
        <Eye className="size-8 opacity-50" />
        <p>{strings.attachments.previewEmpty}</p>
      </div>
    );
  }

  const codeBytes = item.bytes.slice(0, MAX_CODE_PREVIEW_BYTES);
  const code = item.kind === "code" ? new TextDecoder().decode(codeBytes) : "";

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="attachment-preview">
      <div className="shrink-0 border-b px-3 py-2">
        <div className="truncate font-medium text-sm">{baseName(item.path)}</div>
        <div className="truncate text-ink-subtle text-[11px]">
          {item.path} · {formatSize(item.sizeBytes)}
        </div>
      </div>
      {item.kind === "pdf" ? (
        <div className="min-h-0 flex-1" data-testid="attachment-preview-pdf">
          <PdfPane pdf={item.bytes} compiling={false} debugHook={false} />
        </div>
      ) : item.kind === "image" ? (
        <ImageAttachmentPreview item={item} />
      ) : (
        <pre
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-ink/5 p-4 font-mono text-xs"
          data-testid="attachment-preview-code"
        >
          {code}
          {item.bytes.length > MAX_CODE_PREVIEW_BYTES
            ? `\n\n${strings.attachments.previewTruncated}`
            : ""}
        </pre>
      )}
    </div>
  );
}

export function AttachmentsStep({
  attachments,
  onAdd,
  onReplace,
  onDelete,
}: AttachmentsStepProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const ficha = attachments.find((item) => item.path === FICHA_PATH);
  const approval = attachments.find((item) => item.path === SIGNED_APPROVAL_PATH);
  const others = attachments.filter(
    (item) => item.path !== FICHA_PATH && item.path !== SIGNED_APPROVAL_PATH,
  );
  const selected = attachments.find((item) => item.path === selectedPath);

  useEffect(() => {
    if (selectedPath && !selected) setSelectedPath(null);
  }, [selected, selectedPath]);

  return (
    <div
      className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]"
      data-testid="wizard-fs-attachments"
    >
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3">
          <InstitutionalCard
            title={strings.attachments.fichaTitle}
            description={strings.attachments.fichaDescription}
            item={ficha}
            template={ficha?.sizeBytes === TEMPLATE_FICHA_BYTES}
            testId="ficha"
            selected={selectedPath === FICHA_PATH}
            onSelect={() => setSelectedPath(FICHA_PATH)}
            onReplace={onReplace}
            onDelete={onDelete}
            onError={setError}
          />
          <InstitutionalCard
            title={strings.attachments.approvalTitle}
            description={strings.attachments.approvalDescription}
            item={approval}
            testId="aprovacao"
            selected={selectedPath === SIGNED_APPROVAL_PATH}
            onSelect={() => setSelectedPath(SIGNED_APPROVAL_PATH)}
            onReplace={onReplace}
            onDelete={onDelete}
            onError={setError}
          />
        </div>

        <section aria-labelledby="other-attachments-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="other-attachments-title" className="font-medium text-sm">
                {strings.attachments.otherTitle}
              </h3>
              <p className="mt-1 text-ink-muted text-xs">
                {strings.attachments.otherDescription}
              </p>
            </div>
            <input
              ref={addInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              data-testid="attachment-add-input"
              onChange={async (event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                const accepted: AttachmentUpload[] = [];
                const rejected: string[] = [];
                for (const file of files) {
                  if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
                    rejected.push(file.name);
                    continue;
                  }
                  const upload = await asUpload(file);
                  if (rejectAttachment(upload.name, upload.bytes))
                    rejected.push(file.name);
                  else accepted.push(upload);
                }
                setError(
                  rejected.length
                    ? `${strings.attachments.rejectedFiles} ${rejected.join(", ")}`
                    : null,
                );
                if (accepted.length) onAdd(accepted);
              }}
            />
            <button
              type="button"
              data-testid="attachment-add"
              onClick={() => addInputRef.current?.click()}
              className="flex shrink-0 items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-accent-foreground text-xs hover:bg-accent-strong"
            >
              <Upload className="size-3.5" />
              {strings.attachments.add}
            </button>
          </div>

          {others.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded border border-dashed p-4 text-ink-muted text-xs">
              <Paperclip className="size-4" />
              {strings.attachments.none}
            </div>
          ) : (
            <ul className="mt-3 divide-y rounded border" data-testid="attachment-list">
              {others.map((item) => (
                <li
                  key={item.path}
                  className={cn(
                    "flex items-center gap-1",
                    selectedPath === item.path && "bg-accent-soft/50",
                  )}
                  data-testid={`attachment-row-${item.path}`}
                  data-selected={selectedPath === item.path || undefined}
                >
                  <button
                    type="button"
                    aria-pressed={selectedPath === item.path}
                    data-testid={`attachment-select-${item.path}`}
                    onClick={() => setSelectedPath(item.path)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-accent-soft/50"
                  >
                    {iconFor(item.kind)}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{baseName(item.path)}</div>
                      <div className="truncate text-ink-subtle text-[11px]">
                        {item.path} · {formatSize(item.sizeBytes)}
                      </div>
                    </div>
                  </button>
                  <ReplaceButton
                    item={item}
                    onReplace={onReplace}
                    onSelect={() => setSelectedPath(item.path)}
                    onError={setError}
                  />
                  <button
                    type="button"
                    className="mr-1.5 rounded p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
                    aria-label={`${strings.attachments.remove} ${baseName(item.path)}`}
                    data-testid={`attachment-delete-${item.path}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          strings.attachments.confirmDelete.replace(
                            "{name}",
                            baseName(item.path),
                          ),
                        )
                      ) {
                        onDelete(item.path);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p className="text-danger text-xs" role="status" data-testid="attachment-error">
            {error}
          </p>
        )}
      </div>

      <aside
        className="h-[30rem] min-h-0 overflow-hidden rounded-lg border bg-surface lg:sticky lg:top-0"
        aria-label={strings.attachments.previewTitle}
        data-testid="attachment-preview-panel"
      >
        <AttachmentPreview item={selected} />
      </aside>
    </div>
  );
}
