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

      <section className="mt-8">
        <h2 className="font-display text-2xl">Como funciona</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          O UeceTexLive compila LaTeX inteiramente no seu navegador via WebAssembly, com o
          motor busytex (pdfTeX + BibTeX + makeindex). A compilação{" "}
          <strong>Completa</strong> resolve bibliografia, glossário e índice; o{" "}
          <strong>Rascunho</strong> roda uma única passagem rápida (citações aparecem como{" "}
          <code>[?]</code>). O motor é baixado uma única vez (~150 MB comprimidos), em
          segundo plano, assim que você abre o app; depois disso tudo fica salvo no
          navegador e o app funciona <strong>offline</strong> — até no avião.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Modelo</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          Baseado no{" "}
          <a
            href="https://github.com/thiagodnf/uecetex2"
            className="text-accent underline"
          >
            uecetex2
          </a>{" "}
          (abnTeX2 para a UECE). Os{" "}
          <a href={NORM_DOCS} className="text-accent underline">
            guias de normalização da UECE
          </a>{" "}
          estão no repositório upstream.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Licenças</h2>
        <p className="mt-2 text-ink-muted leading-relaxed">
          UeceTexLive é software livre (MIT). Componentes de terceiros — abnTeX2 (LPPL),
          busytex e a fatia do TeX Live (agregado GPL/LPPL), Tiptap, KaTeX, pdf.js e
          outros — mantêm suas próprias licenças. A lista completa está em{" "}
          <a
            href="https://github.com/thiagodnf/uecetex2"
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
