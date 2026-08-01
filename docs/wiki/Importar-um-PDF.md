# Importar um PDF

> **Para quem é:** quem tem o TCC pronto em PDF e quer continuar a escrever
> no UeceTexLive.
> **Você vai concluir:** um projeto editável a partir do seu PDF, com um
> relatório do que foi reconhecido.

**Antes de começar:** o PDF precisa ter sido gerado pelo modelo uecetex2 (o
mesmo deste app). Em PDFs de outra origem o texto costuma sair embaralhado —
o app avisa antes de tentar.

> **Recurso experimental.** A leitura de PDF ainda foi testada em poucos
> trabalhos reais. Exporte uma cópia do que já tem antes de importar.

## Passos

1. Abra o **Menu** e clique em **Importar PDF (experimental)…** (na primeira
   visita, o botão **Já tenho meu TCC em PDF** faz o mesmo).
2. Escolha o arquivo. A leitura acontece **no seu navegador** — o PDF não é
   enviado para lugar nenhum.
3. Acompanhe os três estágios: lendo o PDF, reconhecendo capítulos e figuras,
   montando o projeto.
4. Leia o relatório. Ele diz o que foi reconhecido (capítulos, figuras,
   referências, citações ligadas) e o que vai precisar da sua revisão.
5. Clique em **Criar projeto**. O guia do trabalho abre para você conferir
   título, autor, orientação e o resto dos dados.

## Resultado esperado

Um projeto no painel de arquivos, com os capítulos do seu PDF, e o **Gerar
PDF** funcionando. As pendências da importação ficam listadas em
**Conformidade**, no painel — elas sobrevivem ao recarregamento.

## O que não volta do PDF

Um PDF não guarda o código-fonte, então algumas coisas são reconstruídas por
aproximação e outras se perdem:

- **equações** viram um lugar reservado, para você reescrever;
- **notas de rodapé** voltam presas ao parágrafo, não à palavra exata;
- **citações** que não puderam ser ligadas às referências continuam como
  texto comum;
- **cores, espaçamentos e ajustes finos** que você tenha feito à mão.

## Se algo der errado

- **“Este PDF não parece ter sido gerado pelo modelo da UECE.”** É o aviso de
  perfil. Se você sabe que o arquivo veio do modelo, use **Tentar mesmo
  assim** — a checagem erra em documentos com muitas figuras.
- **“Escolha um arquivo PDF.”** O arquivo tem nome de PDF mas não é um.
- **“Não foi possível ler este PDF… faltou memória.”** Feche outras abas e
  tente de novo.
- Outros sintomas: [Onde pedir ajuda](Onde-pedir-ajuda).

## Próximo passo

[Limitações conhecidas](Limitacoes-conhecidas) — o que o app ainda não faz.

---

*Verificado com UeceTexLive (branch `main`, sem release publicada) e modelo
uecetex2 `4c4ab76` em 2026-08-01. Fontes: `e2e/import-pdf.spec.ts`,
`src/features/import-pdf/`, `src/lib/strings.ts`.*
*Encontrou um erro nesta página? [Abra uma issue](https://github.com/AbraaoAlves/uecetexlive/issues/new?template=documentacao.yml).*
