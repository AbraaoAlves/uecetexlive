/**
 * Validação do arquivo antes de acordar o worker (e baixar o WASM): extensão,
 * assinatura e tamanho. Recusar aqui é mais barato — e mais claro para quem
 * escolheu o arquivo errado.
 */
import { strings } from "@/lib/strings";

export const MAX_PDF_BYTES = 40 * 1024 * 1024;
const PDF_MAGIC = "%PDF-";

/** `null` quando o arquivo serve; senão, o motivo em português. */
export function rejectPdf(name: string, bytes: Uint8Array): string | null {
  if (!name.toLowerCase().endsWith(".pdf")) return strings.importPdf.errorType;
  if (bytes.length > MAX_PDF_BYTES) return strings.importPdf.errorSize;
  const head = new TextDecoder().decode(bytes.slice(0, PDF_MAGIC.length));
  return head === PDF_MAGIC ? null : strings.importPdf.errorType;
}
