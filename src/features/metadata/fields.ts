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
  kind: "text" | "select" | "radio" | "year" | "textarea";
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
  /** Rótulo curto do chip da barra de etapas. */
  short: string;
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

/** O campo tem algum valor digitado? */
const filled = (macro: string) => (fields: ReadonlyMap<string, MetadataField>) =>
  (fields.get(macro)?.value.trim() ?? "") !== "";

/**
 * Revelação progressiva da banca: o slot seguinte só aparece depois que o
 * anterior tem nome — ou quando ele próprio já tem valor, para nunca esconder
 * dado que existe.
 */
const afterSlot = (
  previous: string,
  own: string,
  extra?: (type: WorkType | null) => boolean,
): FieldDef["showWhen"] => {
  const previousFilled = filled(`membrodabanca${previous}`);
  const ownFilled = filled(`membrodabanca${own}`);
  return (type, fields) =>
    (!extra || extra(type)) && (previousFilled(fields) || ownFilled(fields));
};

function bancaSlot(
  slot: string,
  ordinal: number,
  opts?: {
    firstHint?: string;
    /** TCC só imprime 3 membros, dissertação 4, tese 5 (ver uecetex2.sty). */
    showWhen?: FieldDef["showWhen"];
  },
): FieldDef[] {
  const showWhen = opts?.showWhen;
  return [
    {
      macro: `membrodabanca${slot}`,
      label: `Membro ${ordinal} — nome`,
      hint: opts?.firstHint,
      kind: "text",
      section: `Membro ${ordinal}`,
      showWhen,
    },
    { macro: `membrodabanca${slot}ies`, label: "Instituição", kind: "text", showWhen },
    {
      macro: `membrodabanca${slot}centro`,
      label: "Centro / faculdade",
      kind: "text",
      showWhen,
    },
  ];
}

export const WIZARD_STEPS: readonly StepDef[] = [
  {
    id: "titulo",
    title: "Título e tema",
    short: "Título",
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
    short: "Tipo",
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
    short: "Autor",
    fields: [
      { macro: "autor", label: "Seu nome completo", kind: "text" },
      {
        macro: "graduacaoem",
        label: "Curso de graduação",
        hint: "Como aparece no seu histórico. Ex.: “Licenciatura em Computação”",
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
        hint: "Ex.: “Gestão Escolar”",
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
      {
        macro: "ies",
        label: "Instituição",
        hint: "Nome por extenso. Ex.: “Universidade Estadual do Ceará”",
        kind: "text",
        section: "Instituição",
      },
      { macro: "iessigla", label: "Sigla", hint: "Ex.: “UECE”", kind: "text" },
      {
        macro: "centro",
        label: "Centro",
        hint: "O centro ou faculdade a que o seu curso pertence. Ex.: “Centro de Ciências e Tecnologia”",
        kind: "text",
      },
    ],
  },
  {
    id: "orientacao",
    title: "Orientação",
    short: "Orientação",
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
    id: "datalocal",
    title: "Data e local",
    short: "Data",
    description:
      "Ano e cidade que aparecem na capa e na folha de rosto. A data de aprovação só é preenchida depois da defesa.",
    fields: [
      { macro: "data", label: "Ano", kind: "year" },
      {
        macro: "local",
        label: "Local",
        hint: "Cidade e estado, como aparecem na capa. Ex.: “Fortaleza -- Ceará”",
        kind: "text",
      },
      {
        macro: "dataaprovacao",
        label: "Data de aprovação",
        hint: "Ex.: “01 de Julho de 2026” — deixe vazio até a defesa",
        kind: "text",
      },
    ],
  },
  {
    id: "banca",
    title: "Banca examinadora",
    short: "Banca",
    description:
      "A banca é opcional agora — preencha quando ela for definida. Membros sem nome não aparecem na folha de aprovação, e o espaço do próximo membro só abre quando o anterior tem nome.",
    fields: [
      ...bancaSlot("dois", 2, {
        firstHint: "Deixe vazio para não aparecer na folha de aprovação",
      }),
      ...bancaSlot("tres", 3),
      ...bancaSlot("quatro", 4, { showWhen: afterSlot("tres", "quatro") }),
      // TCC (graduação/especialização) imprime só até o membro 4.
      ...bancaSlot("cinco", 5, { showWhen: afterSlot("quatro", "cinco", isStricto) }),
      // Só a tese imprime o 6º membro da banca.
      ...bancaSlot("seis", 6, { showWhen: afterSlot("cinco", "seis", isDoutorado) }),
    ],
  },
  {
    id: "resumo",
    title: "Resumo",
    short: "Resumo",
    description:
      "Escreva por último — é a última coisa que você redige, mas a primeira que a banca lê. Um parágrafo único, de 150 a 500 palavras, na voz ativa e na 3ª pessoa (NBR 6028).",
    fields: [
      {
        macro: "resumobody",
        label: "Resumo (português)",
        hint: "Finalize com as palavras-chave no campo abaixo — não repita aqui.",
        kind: "textarea",
      },
      {
        macro: "palavraschave",
        label: "Palavras-chave",
        hint: "De 3 a 5 termos, separados por ponto e vírgula, finalizados por ponto.",
        kind: "text",
      },
    ],
  },
  {
    id: "abstract",
    title: "Abstract",
    short: "Abstract",
    description:
      "A tradução do resumo para uma língua de circulação internacional, normalmente o inglês. Mesma estrutura, mesma ênfase e os mesmos dados — não é um texto novo.",
    fields: [
      {
        macro: "abstractbody",
        label: "Abstract (inglês)",
        hint: "Tradução fiel do resumo — mesma estrutura, mesma ênfase, mesmos dados.",
        kind: "textarea",
      },
      {
        macro: "keywords",
        label: "Keywords",
        hint: "As mesmas palavras-chave traduzidas, separadas por ponto e vírgula.",
        kind: "text",
      },
    ],
  },
];
