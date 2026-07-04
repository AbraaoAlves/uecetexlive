/**
 * UI copy, pt-BR, centralized (§1.3 / §6.3 of INITIAL_PLAN).
 * No i18n framework by design — extraction later is mechanical.
 */
export const strings = {
  app: {
    name: "UeceTexLive",
    tagline: "Sua monografia UECE, compilada no navegador.",
  },
  topbar: {
    compile: "Compilar",
    compiling: "Compilando…",
    warming: "Preparando motor…",
    export: "Exportar",
    exportPdf: "Baixar PDF",
    exportZip: "Exportar projeto (.zip)",
    menu: "Menu",
    importZip: "Importar ZIP",
    importBbl: "Importar .bbl",
    resetTemplate: "Restaurar modelo",
    about: "Sobre",
    saving: "Salvando…",
    saved: "Salvo",
    toggleRail: "Mostrar/ocultar painel de arquivos",
  },
  engine: {
    draft: "Rascunho",
    full: "Completa",
    fullWarning:
      "A compilação completa baixa ~100 MB na primeira vez (uma única vez — fica salvo no navegador) e resolve bibliografia, glossário e índice. O rascunho é instantâneo, mas mostra [?] nas citações.",
    draftBanner:
      "Modo rascunho: citações, glossário e índice não são resolvidos. Use a compilação Completa para o PDF final.",
  },
  rail: {
    preTextual: "Pré-textuais",
    chapters: "Capítulos",
    postTextual: "Pós-textuais",
    library: "Biblioteca",
    figures: "Figuras",
    missingInclude: "Arquivo não encontrado — clique para criar",
    hiddenFileSingular: "arquivo avançado oculto",
    hiddenFilesPlural: "arquivos avançados ocultos",
    hiddenFilesHint: "Marque “Avançado” na barra superior para vê-los",
  },
  editor: {
    rawLatexTooltip:
      "LaTeX bruto — o UeceTexLive preserva este trecho exatamente como está",
    sourceView: "Fonte LaTeX",
    wysiwygView: "Editor visual",
    placeholder: "Escreva, ou digite / para inserir…",
  },
  metadata: {
    title: "Dados do Trabalho",
    railEntry: "Dados do Trabalho",
    stepsLabel: "Etapas",
    pendingHint: "Preencha o título e os dados do seu trabalho",
    missingMacro: "Não encontrado no documento.tex — edite pelo modo Avançado",
    themeContext: "Seu tema:",
    prev: "Anterior",
    next: "Avançar",
    done: "Concluir",
    close: "Fechar",
    welcomeTitle: "Bem-vindo ao UeceTexLive!",
    welcomeBody:
      "Comece preenchendo os dados do seu trabalho — título, tipo (TCC, dissertação…), autor e orientador. A capa e a folha de rosto são montadas automaticamente no padrão da UECE.",
    welcomeFill: "Preencher dados",
    welcomeLater: "Depois",
  },
  preview: {
    empty: "Compile para ver o PDF aqui.",
    stale: "Compilando…",
    logTab: "Log",
    pdfTab: "PDF",
  },
  rescue: {
    corruptState:
      "Encontramos um estado salvo incompatível. Seu estado anterior foi exportado como zip e o modelo foi restaurado.",
  },
  sobre: {
    title: "Sobre o UeceTexLive",
    privacy: "Tudo acontece no seu navegador: seu texto nunca sai do seu computador.",
  },
} as const;
