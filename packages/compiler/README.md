# @uecetexlive/compiler

Compilação LaTeX no navegador com **dois engines** atrás da mesma interface
`PdfCompiler` (`warmup`/`compile`/`dispose`):

- `busytex-full` — TeX Live completo (pdflatex + bibtex8 + makeindex) via
  busytex; orquestração latexmk-like em TS puro (`runFullBuild`). ~220 MB de
  assets, warmup único; resolve bibliografia/glossário/índice.
- `swiftlatex-draft` — SwiftLaTeX pdfTeX, uma passada, ~3 s; citações viram
  `[?]` (contrato do modo rascunho).

```ts
import { getCompiler } from "@uecetexlive/compiler";

const compiler = await getCompiler("swiftlatex-draft", "/wasm/swiftlatex/");
const result = await compiler.compile({ entry, files, mode: "draft" });
```

O `assetBaseUrl` é **por engine e obrigatório**: este pacote nunca lê
`import.meta.env`. Cada consumidor serve os payloads WASM/TeX nos próprios
assets estáticos (eles **não** entram no pacote npm) — os scripts
`scripts/vendor-busytex.sh` e `scripts/sync-texlive-cache.sh` do repositório
mostram como montá-los.

O sub-export `./react` traz `useCompilerEngine` (máquina de estados de
compilação, engine dual, sem persistência) e `useIdleWarmup` (pré-aquecimento
ocioso) — `react` é peer dependency opcional, só para quem usa esse entry.

## Licenças — leia antes de servir os assets (AGPL)

O código **deste pacote** é MIT. Os artefatos de engine que ele carrega em
runtime têm licenças próprias:

- **SwiftLaTeX (`swiftlatex-draft`)**: `PdfTeXEngine.js`,
  `swiftlatexpdftex.js` e `swiftlatexpdftex.wasm` são **AGPL-3.0** (upgrade
  compatível sobre a base GPLv2+ do pdfTeX). O pacote referencia esses
  arquivos por URL e nunca os embute no bundle JS — mantenha assim.
  Obrigações de quem serve esses arquivos num serviço de rede:
  - publicar o texto da licença junto aos assets (o app de referência mantém
    `public/wasm/swiftlatex/LICENSE`);
  - disponibilizar o **Corresponding Source**, incluindo os dois patches
    locais aplicados aos arquivos do engine (marcados com comentários
    `papyru:` / `Papyru patch:` nos próprios arquivos):
    <https://github.com/AbraaoAlves/uecetexlive> — os arquivos patchados
    vivem em `public/wasm/swiftlatex/` e os patches estão documentados em
    `docs/prototype-compile-pipeline.md`;
  - preservar os avisos de modificação ao atualizar o vendor.
- **busytex (`busytex-full`)**: o glue JS do repositório busytex é MIT, mas
  os binários (`busytex.wasm`, pacotes `.data`) embutem TeX Live — valem as
  licenças TeX Live (GPL/LPPL etc.), como o próprio upstream declara. Não
  existe caminho para um motor pdftex permissivo; ver a decisão de produto
  em `package_extraction.md`.

O CI deste repositório roda `scripts/check-agpl-compliance.sh`: o gate **não
bloqueia AGPL** — ele falha quando o AGPL entra **sem** o acompanhamento
acima (LICENSE ausente, README sem a declaração de licença mista, patch sem
marcação).
