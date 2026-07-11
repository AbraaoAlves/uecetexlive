/**
 * Traduz mensagens cruas do pdfTeX/LaTeX (packages/compiler's log-parser)
 * para PT-BR com uma ação sugerida quando existe uma — §1.5 UI_UX_PLAN.
 *
 * O matcher de citação não-encontrada casa com o aviso genérico do pdfTeX
 * ("Citation `X' ... undefined"), que já independe de qual comando de
 * citação foi usado (\citeonline, \cite, \citep…) — não precisa reconhecer
 * `CitationProfile.citeCommands` aqui, só no .tex fonte.
 *
 * A ação de citação-não-encontrada abre o .bib pra edição manual — um
 * substituto honesto até a busca da Fase 2 existir (troca só o `onClick`).
 */
import type { CompileDiagnostic } from "@papyru/compiler";

export interface DiagnosticAction {
  label: string;
  onClick: () => void;
}

export interface TranslatedDiagnostic {
  message: string;
  action?: DiagnosticAction;
}

export interface TranslateContext {
  /** Caminho do .bib canônico do projeto, se descoberto (include-graph). */
  bibPath: string | null;
  openFile: (path: string) => void;
}

function commandFromExcerpt(excerpt: string): string | null {
  const lineMarker = excerpt.match(/^l\.\d+\s+(.*)$/m);
  const tail = lineMarker?.[1] ?? excerpt;
  return tail.match(/\\[a-zA-Z@]+/)?.[0] ?? null;
}

interface Matcher {
  test: (message: string) => boolean;
  translate: (
    diagnostic: CompileDiagnostic,
    ctx: TranslateContext,
  ) => TranslatedDiagnostic;
}

const MATCHERS: Matcher[] = [
  {
    test: (m) => /Undefined control sequence/i.test(m),
    translate: (d) => {
      const cmd = commandFromExcerpt(d.rawLogExcerpt);
      return {
        message: cmd
          ? `O comando ${cmd} não existe (digitado errado, ou falta carregar o pacote que o define).`
          : "Um comando desconhecido foi usado (digitado errado, ou falta carregar o pacote que o define). Veja o trecho original abaixo.",
      };
    },
  },
  {
    test: (m) => /Missing \$ inserted/i.test(m),
    translate: () => ({
      message:
        "Falta um símbolo de matemática por perto — algo como um subscrito (_), sobrescrito (^) ou uma fórmula precisa estar entre cifrões ($...$).",
    }),
  },
  {
    test: (m) => /File `[^']+' not found/i.test(m),
    translate: (d) => {
      const file = d.message.match(/File `([^']+)' not found/i)?.[1];
      return {
        message: file
          ? `O arquivo "${file}" não foi encontrado. Confira o nome (maiúsculas/minúsculas contam) e se ele foi enviado para o projeto.`
          : "Um arquivo referenciado no documento não foi encontrado.",
      };
    },
  },
  {
    test: (m) => /^Citation `[^']*'.*undefined/i.test(m),
    translate: (d, ctx) => {
      const key = d.message.match(/Citation `([^']*)'/i)?.[1];
      return {
        message: key
          ? `Você citou "${key}", mas essa referência não está na sua lista.`
          : "Uma citação no texto não está na sua lista de referências.",
        action: ctx.bibPath
          ? {
              label: "Ver referências",
              onClick: () => ctx.openFile(ctx.bibPath as string),
            }
          : undefined,
      };
    },
  },
  {
    test: (m) => /Runaway argument/i.test(m),
    translate: () => ({
      message:
        "O LaTeX se perdeu contando um argumento — geralmente uma chave { que não foi fechada. Confira as chaves perto da linha indicada.",
    }),
  },
  {
    test: (m) => /Missing [{}] inserted/i.test(m),
    translate: (d) => ({
      message: /Missing \} inserted/i.test(d.message)
        ? "Falta fechar uma chave: alguma { não tem o } correspondente antes deste ponto."
        : "Sobrou uma chave fechando algo que não tinha aberto (}) — confira o par { } perto da linha indicada.",
    }),
  },
];

const GENERIC_FALLBACK =
  "Não conseguimos traduzir este erro — veja o texto original abaixo.";

export function translateDiagnostic(
  diagnostic: CompileDiagnostic,
  ctx: TranslateContext,
): TranslatedDiagnostic {
  for (const matcher of MATCHERS) {
    if (matcher.test(diagnostic.message)) return matcher.translate(diagnostic, ctx);
  }
  return { message: GENERIC_FALLBACK };
}
