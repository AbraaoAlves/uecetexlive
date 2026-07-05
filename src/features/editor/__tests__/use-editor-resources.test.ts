/**
 * Identity firewall (QA rodada 4 §R4): `project`/`graph` get new identities
 * on every keystroke, but `resources` must hold its identity while content
 * is unchanged — otherwise every citation/figure node view re-renders and
 * the .bib is re-parsed per keystroke.
 */
import { renderHook } from "@testing-library/react";
import type { Project } from "@uecetexlive/project-model";
import { describe, expect, it } from "vitest";
import type { IncludeGraph } from "@/features/project/include-graph";
import { textToBytes } from "@/features/project/vfs";
import { useEditorResources } from "../useEditorResources";

const BIB =
  "@book{k1,\n  author = {Silva, Ana},\n  title = {Obra},\n  year = {2020},\n}\n";

function makeProject(texContent: string, extraPaths: string[] = []): Project {
  return {
    files: [
      {
        path: "elementos-pos-textuais/referencias.bib",
        kind: "bib",
        bytes: textToBytes(BIB),
        editable: false,
      },
      {
        path: "elementos-textuais/introducao.tex",
        kind: "tex",
        bytes: textToBytes(texContent),
        editable: true,
      },
      ...extraPaths.map((path) => ({
        path,
        kind: "image" as const,
        bytes: new Uint8Array([1]),
        editable: false,
      })),
    ],
  } as unknown as Project;
}

function makeGraph(labels: string[]): IncludeGraph {
  return {
    inputs: [],
    labels,
    bibliography: "elementos-pos-textuais/referencias",
    bibliographyStyle: null,
  };
}

describe("useEditorResources", () => {
  it("keeps its identity across keystroke re-renders (same content, new objects)", () => {
    const { result, rerender } = renderHook(
      ({ project, graph }) => useEditorResources(project, graph, undefined),
      { initialProps: { project: makeProject("Olá"), graph: makeGraph(["sec:a"]) } },
    );
    const first = result.current;
    expect(first.bibEntries[0]?.key).toBe("k1");

    // Typing: fresh project/graph identities, prose content changed, but no
    // new files, labels or bib content.
    rerender({ project: makeProject("Olá mundo"), graph: makeGraph(["sec:a"]) });
    expect(result.current).toBe(first);
  });

  it("recomputes when the file list actually changes", () => {
    const { result, rerender } = renderHook(
      ({ project, graph }) => useEditorResources(project, graph, undefined),
      { initialProps: { project: makeProject("Olá"), graph: makeGraph([]) } },
    );
    const first = result.current;

    rerender({
      project: makeProject("Olá", ["figuras/nova.png"]),
      graph: makeGraph([]),
    });
    expect(result.current).not.toBe(first);
    expect(result.current.imageFiles).toContain("figuras/nova.png");
  });

  it("exposes fresh file bytes through closures even while memoized", () => {
    const { result, rerender } = renderHook(
      ({ project, graph }) => useEditorResources(project, graph, undefined),
      { initialProps: { project: makeProject("v1"), graph: makeGraph([]) } },
    );
    const first = result.current;
    rerender({ project: makeProject("v2"), graph: makeGraph([]) });
    expect(result.current).toBe(first); // memo held…
    // …but reads go to the live project, not the one captured at memo time.
    expect(result.current.textFilePreview("elementos-textuais/introducao.tex", 1)).toBe(
      "v2",
    );
  });
});
