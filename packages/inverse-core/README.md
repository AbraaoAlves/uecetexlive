# @papyru/inverse-core

Núcleo do caminho PDF → projeto uecetex2: lê o PDF com o `mupdf`, classifica a
página em estrutura (capítulos, figuras, tabelas, citações, referências) e
emite os `.tex` do modelo.

Três estágios, cada um puro e determinístico — mesma entrada, mesmos bytes:

| Estágio | Módulo | Entra | Sai |
| --- | --- | --- | --- |
| 1 | `extract.ts` | bytes do PDF | IR de linhas, spans e vetores |
| 2 | `classify.ts` | IR | árvore semântica |
| 3 | `emit.ts` | árvore semântica | arquivos do projeto |

`index.ts` encadeia os três em `importPdf()`, que é o que o app chama de dentro
do worker.

**Sem `node:*`.** O pacote roda no navegador, então nenhum módulo daqui pode
importar API de disco — quem grava arquivo é o app, com o mapa de bytes que o
emissor devolve. O gate `scripts/check-agpl-compliance.sh` reprova qualquer
`import ... from "node:"` em `src/`, e é o que mantém a importação de PDF
funcionando na web.

**Licença: AGPL-3.0-or-later**, e não a MIT do resto do repositório. O motivo é
o `mupdf` (Artifex), que é AGPL-3.0 e é ligado por `extract.ts`: a obra
combinada herda os termos dele. Ver `THIRD_PARTY.md` na raiz.
