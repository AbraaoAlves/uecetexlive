# @papyru/inverse-core

Núcleo do caminho PDF → projeto uecetex2, **vendorado** do repositório
[`uecetex-inverse`](https://github.com/AbraaoAlves/uecetex-inverse) pelo
`scripts/vendor-inverse-core.sh`. O commit de origem fica no `manifest.json`.

Só os módulos puros entram aqui: as cascas de disco (`cli.ts`, `emit-fs.ts`)
ficam de fora, e o script recusa vendorar qualquer arquivo que importe
`node:*`. É o que permite rodar o mesmo pipeline no navegador.

**Licença:** o pacote depende do `mupdf` (Artifex), que é **AGPL-3.0**. Veja
`THIRD_PARTY.md` na raiz do repositório.

Não edite os arquivos de `src/` aqui: a mudança se perde na próxima
vendorização. Corrija na origem e rode o script de novo.
