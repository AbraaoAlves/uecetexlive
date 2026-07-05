/**
 * Declarative catalog for the "Dados do Trabalho" wizard (F2). Labels live
 * inline, like the slash-menu COMMANDS. Fields with `verbatim` write their
 * value as-is (enums); free text is escaped by the wizard before applying.
 */
import type { MetadataField, WorkType } from "@/features/project/metadata";

export interface FieldOption {
  value: string;
  label: string;
  /** Longer guidance shown on radio cards (work-type step). */
  description?: string;
}

export interface FieldDef {
  macro: string;
  label: string;
  hint?: string;
  kind: "text" | "select" | "radio" | "year";
  options?: readonly FieldOption[];
  /** Enum values written verbatim (no LaTeX escaping). */
  verbatim?: boolean;
  /** Sub-heading rendered above this field within the step. */
  section?: string;
  showWhen?: (
    type: WorkType | null,
    fields: ReadonlyMap<string, MetadataField>,
  ) => boolean;
}

export interface StepDef {
  id: string;
  title: string;
  description?: string;
  fields: FieldDef[];
}

const isGrad = (t: WorkType | null) => t === "tccgraduacao";
const isEspec = (t: WorkType | null) => t === "tccespecializacao";
const isMestrado = (t: WorkType | null) => t === "dissertacao";
const isDoutorado = (t: WorkType | null) => t === "tese";
const isStricto = (t: WorkType | null) => t === "dissertacao" || t === "tese";
const isUab = (_type: WorkType | null, fields: ReadonlyMap<string, MetadataField>) =>
  fields.get("ehuab")?.value.trim() === "sim";

function bancaSlot(slot: string, ordinal: number, firstHint?: string): FieldDef[] {
  return [
    {
      macro: `membrodabanca${slot}`,
      label: `Membro ${ordinal} — nome`,
      hint: firstHint,
      kind: "text",
      section: `Membro ${ordinal}`,
    },
    { macro: `membrodabanca${slot}ies`, label: "Instituição", kind: "text" },
    { macro: `membrodabanca${slot}centro`, label: "Centro / faculdade", kind: "text" },
  ];
}

export const WIZARD_STEPS: readonly StepDef[] = [
  {
    id: "titulo",
    title: "Título e tema",
    description:
      "Comece pelo tema. Um bom título resume o assunto, o método e o contexto do trabalho — você poderá ajustá-lo a qualquer momento.",
    fields: [
      {
        macro: "titulo",
        label: "Título do trabalho",
        hint: "Ex.: “Uso de jogos digitais no ensino de programação no ensino médio”",
        kind: "text",
      },
    ],
  },
  {
    id: "tipo",
    title: "Tipo de trabalho",
    description:
      "O tipo define a capa, a folha de rosto e o texto de apresentação gerados automaticamente pelo modelo da UECE.",
    fields: [
      {
        macro: "trabalhoacademico",
        label: "Tipo",
        kind: "radio",
        verbatim: true,
        options: [
          {
            value: "tccgraduacao",
            label: "TCC — Graduação",
            description:
              "Monografia de conclusão de licenciatura ou bacharelado (ex.: Licenciatura em Computação).",
          },
          {
            value: "tccespecializacao",
            label: "TCC — Especialização",
            description:
              "Trabalho final de curso de especialização (pós-graduação lato sensu).",
          },
          {
            value: "dissertacao",
            label: "Dissertação — Mestrado",
            description: "Trabalho de mestrado (pós-graduação stricto sensu).",
          },
          {
            value: "tese",
            label: "Tese — Doutorado",
            description: "Trabalho de doutorado (pós-graduação stricto sensu).",
          },
        ],
      },
      {
        macro: "ehqualificacao",
        label: "É uma qualificação?",
        kind: "select",
        verbatim: true,
        options: [
          { value: "nao", label: "Não — versão final" },
          { value: "sim", label: "Sim — exame de qualificação" },
        ],
        showWhen: isStricto,
      },
      {
        macro: "ehuab",
        label: "É modalidade UAB (Universidade Aberta do Brasil)?",
        kind: "select",
        verbatim: true,
        options: [
          { value: "nao", label: "Não" },
          { value: "sim", label: "Sim — polo EAD/UAB" },
        ],
        section: "Modalidade UAB",
        hint:
          "Adiciona o brasão e a linha “Universidade Aberta do Brasil” na capa " +
          "(e, em TCC, a frase de parceria na folha de rosto).",
      },
      {
        macro: "localdopolo",
        label: "Local do polo",
        kind: "text",
        hint:
          "Cidade do polo (ex.: “Limoeiro do Norte -- Ceará”). Substitui o " +
          "Local apenas na capa.",
        showWhen: isUab,
      },
    ],
  },
  {
    id: "autor",
    title: "Autor e curso",
    fields: [
      { macro: "autor", label: "Seu nome completo", kind: "text" },
      {
        macro: "graduacaoem",
        label: "Curso de graduação",
        hint: "Ex.: “Ciência da Computação”",
        kind: "text",
        showWhen: isGrad,
      },
      {
        macro: "habilitacao",
        label: "Habilitação",
        kind: "select",
        verbatim: true,
        options: [
          { value: "bacharel", label: "Bacharel" },
          { value: "bacharela", label: "Bacharela" },
          { value: "licenciado", label: "Licenciado" },
          { value: "licenciada", label: "Licenciada" },
        ],
        showWhen: isGrad,
      },
      {
        macro: "especializacaoem",
        label: "Curso de especialização",
        kind: "text",
        showWhen: isEspec,
      },
      {
        macro: "programamestrado",
        label: "Programa de pós-graduação",
        kind: "text",
        showWhen: isMestrado,
      },
      {
        macro: "nomedomestrado",
        label: "Nome do mestrado",
        kind: "text",
        showWhen: isMestrado,
      },
      { macro: "mestreem", label: "Mestre em", kind: "text", showWhen: isMestrado },
      {
        macro: "areadeconcentracaomestrado",
        label: "Área de concentração",
        kind: "text",
        showWhen: isMestrado,
      },
      {
        macro: "programadoutorado",
        label: "Programa de pós-graduação",
        kind: "text",
        showWhen: isDoutorado,
      },
      {
        macro: "nomedodoutorado",
        label: "Nome do doutorado",
        kind: "text",
        showWhen: isDoutorado,
      },
      { macro: "doutorem", label: "Doutor em", kind: "text", showWhen: isDoutorado },
      {
        macro: "areadeconcentracaodoutorado",
        label: "Área de concentração",
        kind: "text",
        showWhen: isDoutorado,
      },
      { macro: "ies", label: "Instituição", kind: "text", section: "Instituição" },
      { macro: "iessigla", label: "Sigla", kind: "text" },
      { macro: "centro", label: "Centro", kind: "text" },
    ],
  },
  {
    id: "orientacao",
    title: "Orientação",
    fields: [
      {
        macro: "orientador",
        label: "Nome do orientador(a)",
        hint: "Inclua o título: Prof. Dr., Profa. Dra., …",
        kind: "text",
      },
      {
        macro: "orientadorfeminino",
        label: "Tratamento",
        kind: "select",
        verbatim: true,
        options: [
          { value: "nao", label: "Orientador" },
          { value: "sim", label: "Orientadora" },
        ],
      },
      { macro: "orientadories", label: "Instituição do orientador", kind: "text" },
      { macro: "orientadorcentro", label: "Centro do orientador", kind: "text" },
      {
        macro: "coorientador",
        label: "Nome do coorientador(a)",
        hint: "Deixe vazio para não aparecer no documento",
        kind: "text",
        section: "Coorientação (opcional)",
      },
      {
        macro: "coorientadorfeminino",
        label: "Tratamento",
        kind: "select",
        verbatim: true,
        options: [
          { value: "nao", label: "Coorientador" },
          { value: "sim", label: "Coorientadora" },
        ],
      },
      { macro: "coorientadories", label: "Instituição do coorientador", kind: "text" },
      { macro: "coorientadorcentro", label: "Centro do coorientador", kind: "text" },
    ],
  },
  {
    id: "finalizacao",
    title: "Data, local e banca",
    description:
      "A banca é opcional agora — preencha quando ela for definida. Membros sem nome não aparecem na folha de aprovação.",
    fields: [
      { macro: "data", label: "Ano", kind: "year" },
      { macro: "local", label: "Local", kind: "text" },
      {
        macro: "dataaprovacao",
        label: "Data de aprovação",
        hint: "Ex.: “01 de Julho de 2026” — deixe vazio até a defesa",
        kind: "text",
      },
      ...bancaSlot("dois", 2, "Deixe vazio para não aparecer na folha de aprovação"),
      ...bancaSlot("tres", 3),
      ...bancaSlot("quatro", 4),
      ...bancaSlot("cinco", 5),
      ...bancaSlot("seis", 6),
    ],
  },
];
