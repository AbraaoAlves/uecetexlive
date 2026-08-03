/**
 * Passo "Elementos opcionais" do guia: as mesmas linhas que a caixinha do
 * painel liga e desliga, reunidas num lugar só e com nome de gente.
 *
 * Elemento que não existe no documento não aparece — a mesma disciplina do
 * campo desabilitado do assistente: nunca criar uma linha que não está lá.
 */
import { strings } from "@/lib/strings";
import {
  AUTOMATIC_LISTS,
  LANGUAGE_ELEMENT,
  OPTIONAL_PAGES,
  type OptionalElement,
} from "./optional-elements";

export interface OptionalsStepProps {
  toggles: ReadonlyMap<string, { macro: string; enabled: boolean }>;
  onToggle: (macro: string, enabled: boolean) => void;
}

function Group({
  title,
  elements,
  toggles,
  onToggle,
}: { title: string; elements: readonly OptionalElement[] } & OptionalsStepProps) {
  const present = elements.filter((e) => toggles.has(e.macro));
  if (present.length === 0) return null;
  return (
    <section className="mt-4">
      <div className="border-b pb-1 font-medium text-[11px] text-ink-subtle uppercase tracking-wider">
        {title}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {present.map((element) => (
          <label
            key={element.macro}
            className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-accent-soft/40"
          >
            <input
              type="checkbox"
              data-testid={`wizard-fs-toggle-${element.macro}`}
              checked={toggles.get(element.macro)?.enabled ?? false}
              onChange={(e) => onToggle(element.macro, e.currentTarget.checked)}
              className="mt-0.5 size-3.5 shrink-0 accent-accent"
            />
            <span>
              <span className="block text-sm">{element.label}</span>
              {element.hint && (
                <span className="block text-ink-subtle text-xs">{element.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function OptionalsStep({ toggles, onToggle }: OptionalsStepProps) {
  return (
    <div data-testid="wizard-fs-optionals">
      <Group
        title={strings.metadata.optionalPagesGroup}
        elements={OPTIONAL_PAGES}
        toggles={toggles}
        onToggle={onToggle}
      />
      <Group
        title={strings.metadata.automaticListsGroup}
        elements={AUTOMATIC_LISTS}
        toggles={toggles}
        onToggle={onToggle}
      />
      <Group
        title={strings.metadata.languageGroup}
        elements={[LANGUAGE_ELEMENT]}
        toggles={toggles}
        onToggle={onToggle}
      />
    </div>
  );
}
