import { Link } from "@tanstack/react-router";
import { strings } from "@/lib/strings";

const NORM_DOCS =
  "https://github.com/thiagodnf/uecetex2/tree/master/doc/Guias%20de%20Normaliza%C3%A7%C3%A3o%20da%20UECE";

export function SobreRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/" className="text-accent text-sm underline">
        ← {strings.app.name}
      </Link>
      <h1 className="mt-4 font-display text-4xl">{strings.sobre.title}</h1>
      <p className="mt-4 text-ink-muted leading-relaxed">{strings.sobre.privacy}</p>
      <p className="mt-2 text-ink-muted leading-relaxed">
        {strings.sobre.wikiIntro}{" "}
        <a
          href="https://github.com/AbraaoAlves/uecetexlive/wiki"
          className="text-accent underline"
        >
          {strings.sobre.wikiLink}
        </a>
        .
      </p>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Como funciona</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          O UeceTexLive compila LaTeX inteiramente no seu navegador via WebAssembly. A
          compilação <strong>Completa</strong> usa o busytex (pdfTeX + BibTeX + makeindex)
          e resolve bibliografia, glossário e índice; o <strong>Rascunho</strong> usa o
          SwiftLaTeX pdfTeX para uma prévia instantânea (citações aparecem como{" "}
          <code>[?]</code>). Depois da primeira compilação Completa, tudo fica salvo no
          navegador e o app funciona <strong>offline</strong> — até no avião.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Modelo</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          Baseado no uecetex2 (abnTeX2 para a UECE). O UeceTexLive usa um snapshot fixo do
          fork{" "}
          <a
            href="https://github.com/abraaoalves/uecetex2"
            className="text-accent underline"
          >
            abraaoalves/uecetex2
          </a>{" "}
          (commit <code>4c4ab76</code>), derivado do upstream{" "}
          <a
            href="https://github.com/thiagodnf/uecetex2"
            className="text-accent underline"
          >
            thiagodnf/uecetex2
          </a>
          . Os{" "}
          <a href={NORM_DOCS} className="text-accent underline">
            guias de normalização da UECE
          </a>{" "}
          estão no repositório upstream.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">{strings.sobre.backupTitle}</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">{strings.sobre.backupBody}</p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Licenças</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          UeceTexLive é software livre (MIT). Componentes de terceiros — abnTeX2 (LPPL),
          busytex e a fatia do TeX Live (agregado GPL/LPPL), o motor SwiftLaTeX (AGPL-3.0,
          distribuído com correções documentadas), o leitor de PDF mupdf.js (AGPL-3.0, da
          Artifex, distribuído sem modificações e carregado só quando você importa um
          PDF), Tiptap, KaTeX, pdf.js e outros — mantêm suas próprias licenças. A lista
          completa está em{" "}
          <a
            href="https://github.com/AbraaoAlves/uecetexlive/blob/main/THIRD_PARTY.md"
            className="text-accent underline"
          >
            THIRD_PARTY.md
          </a>
          .
        </p>
      </section>
    </main>
  );
}
