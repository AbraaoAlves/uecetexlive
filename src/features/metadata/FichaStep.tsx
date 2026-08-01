/**
 * Passo "Ficha catalográfica" do guia: substituir o PDF de exemplo pelo que a
 * biblioteca emite. Aceita só PDF de verdade (assinatura `%PDF-`) e até 5 MB —
 * a ficha é uma página; arquivo maior é engano.
 */
import { useRef, useState } from "react";
import { strings } from "@/lib/strings";

/**
 * Tamanho em bytes da ficha de exemplo do modelo — é como sabemos se o aluno
 * já enviou a dele. Um teste-sentinela confere contra o manifesto vendorado.
 */
export const TEMPLATE_FICHA_BYTES = 175_366;

export const MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAGIC = "%PDF-";

export interface FichaStepProps {
  onUpload: (bytes: Uint8Array) => void;
  /** Tamanho da ficha atual do projeto; `null` quando não existe. */
  sizeBytes: number | null;
}

/** `null` quando o arquivo serve; senão, o motivo em português. */
export function rejectFicha(name: string, bytes: Uint8Array): string | null {
  if (!name.toLowerCase().endsWith(".pdf")) return strings.ficha.errorType;
  if (bytes.length > MAX_BYTES) return strings.ficha.errorSize;
  const head = new TextDecoder().decode(bytes.slice(0, PDF_MAGIC.length));
  if (head !== PDF_MAGIC) return strings.ficha.errorType;
  return null;
}

export function FichaStep({ onUpload, sizeBytes }: FichaStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const isTemplate = sizeBytes === TEMPLATE_FICHA_BYTES;

  return (
    <div className="mt-4" data-testid="wizard-fs-ficha">
      <p className="text-sm" data-testid="ficha-state">
        {sizeBytes === null
          ? strings.ficha.missing
          : isTemplate
            ? strings.ficha.fromTemplate
            : strings.ficha.uploaded}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        data-testid="ficha-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          // Tamanho antes de ler: arquivo enorme escolhido por engano não
          // precisa virar memória para ser recusado.
          if (file.size > MAX_BYTES) {
            setError(strings.ficha.errorSize);
            return;
          }
          const bytes = new Uint8Array(await file.arrayBuffer());
          const problem = rejectFicha(file.name, bytes);
          setError(problem);
          if (!problem) onUpload(bytes);
        }}
      />
      <button
        type="button"
        data-testid="ficha-upload"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded border px-3 py-1.5 text-sm hover:bg-accent-soft"
      >
        {strings.ficha.upload}
      </button>
      {error && (
        <p className="mt-2 text-danger text-xs" role="status" data-testid="ficha-error">
          {error}
        </p>
      )}
    </div>
  );
}
