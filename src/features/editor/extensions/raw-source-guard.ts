/**
 * rawSource invalidation (§4.3 fidelity): when a transaction touches content
 * inside a node that carries cached `rawSource` bytes, the cache is stale —
 * clear it so serialization regenerates from the structured content.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const RawSourceGuard = Extension.create({
  name: "rawSourceGuard",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("rawSourceGuard"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          // Collect changed ranges in the new doc.
          const ranges: { from: number; to: number }[] = [];
          for (const tr of transactions) {
            if (!tr.docChanged) continue;
            for (const map of tr.mapping.maps) {
              map.forEach((_fromA, _toA, fromB, toB) => {
                ranges.push({ from: fromB, to: toB });
              });
            }
          }
          if (ranges.length === 0) return null;

          const fix = newState.tr;
          let mutated = false;
          for (const { from, to } of ranges) {
            newState.doc.nodesBetween(
              Math.max(0, from),
              Math.min(newState.doc.content.size, to),
              (node, pos) => {
                if (node.attrs?.rawSource != null) {
                  fix.setNodeMarkup(pos, null, { ...node.attrs, rawSource: null });
                  mutated = true;
                }
              },
            );
          }
          return mutated ? fix : null;
        },
      }),
    ];
  },
});
