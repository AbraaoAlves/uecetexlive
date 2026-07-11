import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferencesPanel } from "./ReferencesPanel";

// No `globals: true` in vite.config.ts's test config, so @testing-library/react's
// own auto-cleanup (which relies on a global `afterEach`) never runs — without
// this, each render() in the file piles onto the same document.
afterEach(cleanup);

const SAMPLE = `@book{freire1970,
  author = {Freire, Paulo},
  title = {Pedagogia do Oprimido},
  publisher = {Paz e Terra},
  year = {1970}
}

@article{lamport1986,
  author = {Lamport, Leslie},
  title = {LaTeX: User's Guide},
  journal = {Addison-Wesley},
  year = {1986}
}
`;

const WITH_FAILURE = `${SAMPLE}
@article{broken, title = {unterminated
`;

describe("ReferencesPanel", () => {
  it("lists every entry from the .bib fixture", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    expect(screen.getByTestId("reference-freire1970")).toBeTruthy();
    expect(screen.getByTestId("reference-lamport1986")).toBeTruthy();
    expect(screen.getByText("Pedagogia do Oprimido")).toBeTruthy();
    expect(screen.getByText("Freire, P.")).toBeTruthy();
    expect(screen.getByText("Livro")).toBeTruthy();
  });

  it("shows a failure card for a malformed entry without dropping the others", () => {
    render(<ReferencesPanel bibText={WITH_FAILURE} />);
    expect(screen.getByTestId("reference-freire1970")).toBeTruthy();
    expect(screen.getByTestId("reference-lamport1986")).toBeTruthy();
    expect(screen.getByTestId("reference-parse-failure")).toBeTruthy();
    expect(screen.getByText("Não consegui ler esta referência")).toBeTruthy();
  });

  it("shows an empty state when no .bib file was discovered", () => {
    render(<ReferencesPanel bibText={null} />);
    expect(screen.getByTestId("references-empty")).toBeTruthy();
  });

  it("toggles to the raw source view", () => {
    render(<ReferencesPanel bibText={SAMPLE} />);
    fireEvent.click(screen.getByTestId("references-toggle-code"));
    expect(screen.getByTestId("references-raw").textContent).toContain(
      "@book{freire1970,",
    );
  });
});
