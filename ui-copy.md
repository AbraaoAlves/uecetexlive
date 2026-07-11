# Glossário de copy (PT-BR)

Regras da §1.3 do `UI_UX_PLAN.md`, para manter consistência conforme a UI cresce.
Toda string nova da UI deve entrar em `src/lib/strings.ts` (nunca hardcoded em JSX)
e seguir estas traduções:

| Termo técnico | Nunca escrever | Sempre escrever |
|---|---|---|
| compile / compilar | "Compilar", "Compilando…" | "Gerar PDF", "Gerando PDF…" |
| template | "Template" | "Modelo" |
| compile log | "Log" | "Detalhes" |
| WASM / WebAssembly | exposto na UI de trabalho | omitido (ok na página `/sobre`, que é opt-in e explicitamente técnica) |
| engine (en) | "Engine" | "Motor" (já traduzido) |
| toolchain | — | nunca aparece |

## Exceções deliberadas

- `src/routes/sobre.tsx` ("Como funciona" / "Licenças"): página opt-in sobre
  internals e licenças de terceiros — aqui `WebAssembly`, `busytex`, `pdfTeX`,
  `BibTeX`, `SwiftLaTeX` etc. são termos corretos e necessários (transparência
  técnica e obrigação de licença), não jargão a esconder.
- `ImportDialog.tsx` (import de `.bbl`/ZIP): já é um fluxo avançado
  (biber/BibTeX pré-compilado) — os termos ali são para quem já os reconhece.

## Pendências conhecidas (fora do escopo desta passada)

- `packages/compiler` (pacote compartilhado com o Papyru comercial) ainda
  gera rótulos de progresso como `"Compilando (1/6): primeira passagem…"`
  (`orchestrator.ts`) e mensagens de erro em inglês cru (`"worker not
  started"`, `"Engine error: …"`) que vazam pro `LogPane`. Não foram
  tocados aqui por serem shared package + porque a tradução de erros tem
  fatia própria (1.5 — Tradução de erros LaTeX comuns), que deve envolver
  também esses vazamentos de inglês técnico.
