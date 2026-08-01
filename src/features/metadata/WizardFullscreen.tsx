/**
 * Guia "Dados do Trabalho" em tela cheia (item 6).
 *
 * Mesmo catálogo de campos do modal — o modal é a edição rápida de quem já
 * conhece o trabalho; o guia é o primeiro uso, e vai além dos metadados: leva
 * o aluno pelos elementos opcionais e pela ficha catalográfica, coisas que
 * antes exigiam abrir o `documento.tex`, e termina gerando o PDF.
 *
 * Overlay dentro do AppShell, não rota própria: o estado do projeto já vive
 * todo lá, e assim nenhum store precisa ser extraído.
 */
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  escapeMetadataValue,
  type MetadataField,
  workTypeOf,
} from "@/features/project/metadata";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { FichaStep } from "./FichaStep";
import { type FieldDef, type StepDef, WIZARD_STEPS } from "./fields";
import { OptionalsStep } from "./OptionalsStep";
import { WizardField } from "./WizardField";

/** Passos que só existem no guia — o modal continua com os oito da Fase 1. */
const EXTRA_STEPS: StepDef[] = [
  {
    id: "opcionais",
    title: "Elementos opcionais",
    short: "Opcionais",
    description:
      "Escolha o que entra no seu PDF. Desmarcar não apaga nada: o texto continua no projeto e volta quando você marcar de novo.",
    fields: [],
  },
  {
    id: "ficha",
    title: "Ficha catalográfica",
    short: "Ficha",
    description:
      "A biblioteca da UECE gera este PDF a partir de um formulário. Envie aqui o arquivo que você receber; até lá fica o exemplo do modelo.",
    fields: [],
  },
  {
    id: "revisao",
    title: "Revisão final",
    short: "Revisão",
    description: "O que ainda falta, e o que já está pronto.",
    fields: [],
  },
];

export const WIZARD_STEPS_FULL: readonly StepDef[] = [...WIZARD_STEPS, ...EXTRA_STEPS];

export interface WizardFullscreenProps {
  fields: ReadonlyMap<string, MetadataField>;
  onApply: (updates: Map<string, string>) => void;
  onClose: () => void;
  /** Estado das linhas opcionais do documento e como mudá-las. */
  toggles: ReadonlyMap<string, { macro: string; enabled: boolean }>;
  onToggle: (macro: string, enabled: boolean) => void;
  /** Substitui a ficha catalográfica do projeto. */
  onFicha: (bytes: Uint8Array) => void;
  /** Tamanho em bytes da ficha atual, para dizer se ainda é a do modelo. */
  fichaSize: number | null;
  /** Gera o PDF e fecha o guia. */
  onCompile: () => void;
  /** O projeto já está gravado? Governa o selo "salvo" dos campos. */
  persisted?: boolean;
  initialStep?: number;
}

/**
 * Campos obrigatórios que ainda não estão prontos, na ordem do guia: vazios,
 * ou com o aviso do próprio campo aceso — o título de exemplo do modelo não
 * está vazio, mas também não é o título do trabalho.
 */
function pendingOf(
  fields: ReadonlyMap<string, MetadataField>,
  workType: ReturnType<typeof workTypeOf>,
): { step: number; def: FieldDef }[] {
  const out: { step: number; def: FieldDef }[] = [];
  WIZARD_STEPS_FULL.forEach((step, index) => {
    for (const def of step.fields) {
      if (!def.required) continue;
      if (def.showWhen && !def.showWhen(workType, fields)) continue;
      const value = fields.get(def.macro)?.value.trim() ?? "";
      if (value === "" || def.validate?.(value)) out.push({ step: index, def });
    }
  });
  return out;
}

export function WizardFullscreen({
  fields,
  onApply,
  onClose,
  toggles,
  onToggle,
  onFicha,
  fichaSize,
  onCompile,
  persisted = true,
  initialStep = 0,
}: WizardFullscreenProps) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const workType = workTypeOf(fields);
  const step = WIZARD_STEPS_FULL[stepIndex] ?? WIZARD_STEPS_FULL[0];
  const visibleFields = (step?.fields ?? []).filter(
    (f) => !f.showWhen || f.showWhen(workType, fields),
  );
  const firstFieldMacro = visibleFields[0]?.macro;
  useEffect(() => {
    if (!firstFieldMacro) return;
    bodyRef.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      )
      ?.focus();
  }, [firstFieldMacro]);

  if (!step) return null;
  const pending = pendingOf(fields, workType);
  const pendingSteps = new Set(pending.map((p) => p.step));
  const isLast = stepIndex === WIZARD_STEPS_FULL.length - 1;

  const commit = (def: FieldDef, raw: string): boolean => {
    const value = def.verbatim
      ? raw
      : escapeMetadataValue(def.kind === "textarea" ? raw : raw.trim());
    const current = fields.get(def.macro)?.value;
    if (current === undefined || current === value) return false;
    const updates = new Map([[def.macro, value]]);
    if (def.macro === "ehuab" && value === "nao") {
      const polo = fields.get("localdopolo");
      if (polo && polo.value !== "") updates.set("localdopolo", "");
    }
    onApply(updates);
    return true;
  };

  /** Um passo está completo quando não tem obrigatório vazio. */
  const isComplete = (index: number) =>
    !pendingSteps.has(index) &&
    (WIZARD_STEPS_FULL[index]?.fields.some((f) => f.required) ?? false);

  return (
    <div className="fixed inset-0 z-50 flex bg-surface" data-testid="wizard-fs">
      <nav
        aria-label={strings.metadata.stepsLabel}
        className="hidden w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-3 md:flex"
      >
        <div className="mb-2 px-2 font-display text-base">
          {strings.metadata.guideTitle}
        </div>
        {WIZARD_STEPS_FULL.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-testid={`wizard-fs-step-${s.id}`}
            onClick={() => setStepIndex(i)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
              i === stepIndex
                ? "bg-accent-soft font-medium text-accent-strong"
                : "text-ink-muted hover:bg-accent-soft/60",
            )}
          >
            {isComplete(i) ? (
              <Check className="size-3.5 shrink-0 text-success" />
            ) : (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  pendingSteps.has(i) ? "bg-warning" : "bg-ink-subtle/40",
                )}
              />
            )}
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center border-b px-6 py-3">
          <h2 className="font-display text-xl">{step.title}</h2>
          <button
            type="button"
            data-testid="wizard-fs-close"
            aria-label={strings.metadata.close}
            className="ml-auto rounded p-1.5 text-ink-muted hover:bg-accent-soft"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-6 py-4">
            {step.description && (
              <p className="text-ink-muted text-sm">{step.description}</p>
            )}
            <div
              ref={bodyRef}
              className={cn(
                "mt-4 grid grid-cols-1 gap-x-4 gap-y-3",
                step.columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
              )}
            >
              {visibleFields.map((def) => (
                <div key={def.macro} className="contents">
                  {def.section && (
                    <div className="mt-1 border-b pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider md:col-span-full">
                      {def.section}
                    </div>
                  )}
                  <WizardField
                    def={def}
                    field={fields.get(def.macro)}
                    onCommit={commit}
                    persisted={persisted}
                  />
                </div>
              ))}
            </div>
            {step.id === "opcionais" && (
              <OptionalsStep toggles={toggles} onToggle={onToggle} />
            )}
            {step.id === "ficha" && (
              <FichaStep onUpload={onFicha} sizeBytes={fichaSize} />
            )}
            {step.id === "revisao" && (
              <div className="mt-2">
                {pending.length === 0 ? (
                  <p className="text-success text-sm" data-testid="wizard-fs-ready">
                    {strings.metadata.reviewReady}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1" data-testid="wizard-fs-pending">
                    {pending.map((p) => (
                      <li key={p.def.macro}>
                        <button
                          type="button"
                          data-testid={`wizard-fs-pending-${p.def.macro}`}
                          onClick={() => setStepIndex(p.step)}
                          className="text-accent text-sm hover:underline"
                        >
                          {p.def.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  data-testid="wizard-fs-compile"
                  onClick={onCompile}
                  className="mt-4 rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
                >
                  {strings.topbar.compile}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t px-6 py-3">
          <button
            type="button"
            data-testid="wizard-fs-prev"
            disabled={stepIndex === 0}
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-accent-soft disabled:opacity-40"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            {strings.metadata.prev}
          </button>
          <span className="text-ink-subtle text-xs">
            {stepIndex + 1} / {WIZARD_STEPS_FULL.length}
          </span>
          <button
            type="button"
            data-testid={isLast ? "wizard-fs-done" : "wizard-fs-next"}
            className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
            onClick={() =>
              isLast
                ? onClose()
                : setStepIndex((i) => Math.min(WIZARD_STEPS_FULL.length - 1, i + 1))
            }
          >
            {isLast ? strings.metadata.done : strings.metadata.next}
          </button>
        </div>
      </div>
    </div>
  );
}
