# Política de segurança

O UeceTexLive é uma aplicação **100% estática e local**: não há backend, não
há contas, nenhum dado é enviado a um servidor para compilar. Isso reduz a
superfície de ataque, mas não a zera.

## Como relatar uma vulnerabilidade

Use o **GitHub Security Advisories** deste repositório (relatório privado de
vulnerabilidade): na aba "Security" do repositório, "Report a vulnerability".
Isso cria uma conversa privada com os mantenedores, sem expor o problema
publicamente antes de uma correção.

> Este canal depende de "Private vulnerability reporting" estar habilitado
> nas configurações do repositório (Settings → Security) — ainda pendente.
> Se o formulário de relatório privado não estiver disponível, entre em
> contato pelos canais
> listados em [`SUPPORT.md`](SUPPORT.md) marcando claramente que se trata de
> uma vulnerabilidade, para tratamento discreto.

Inclua, quando possível: passos para reproduzir, impacto esperado, e se
envolve perda/exposição de dados do usuário.

## O que é considerado uma vulnerabilidade aqui

- **XSS ou execução de código via projeto importado** — um `.zip`/LaTeX
  malicioso importado que consiga executar script fora do sandbox esperado
  do editor/preview.
- **Problemas de supply chain nos vendors WASM** — integridade dos artefatos
  baixados pelos scripts `vendor-uecetex2.sh`, `vendor-busytex.sh` e
  `sync-texlive-cache.sh` (ex.: fonte adulterada, ausência de verificação de
  integridade).
- **Perda ou exposição indevida de dados do IndexedDB** — o único
  armazenamento persistente do app; um bug que vaze o conteúdo de um projeto
  de um contexto de origem para outro, ou que corrompa dados sem aviso, é uma
  vulnerabilidade de dados do usuário.

## O que NÃO é uma vulnerabilidade

- Bugs de compilação (PDF não gera, citação não resolve, erro do motor
  busytex/SwiftLaTeX) — abra uma **issue normal** com o template de bug.
- Limitações já documentadas (ex.: Biber nativo não suportado, abnTeX2 não
  fixado) — ver [`Limitacoes-conhecidas.md`](docs/wiki/Limitacoes-conhecidas.md).
- Problemas de acessibilidade — são dívida de produto registrada
  (SKIP 3.6 em [`docs/decisions.md`](docs/decisions.md)), tratados como
  issues normais com a label `accessibility`, não como vulnerabilidades.

## Versões suportadas

O projeto ainda não publicou uma release estável (sem tags `v*` no momento
desta escrita) — não há política de backport; relate contra a versão do
`main`.
