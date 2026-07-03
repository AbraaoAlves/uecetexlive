/**
 * `$…$` input rule (§4.5): closing the second $ converts the span into an
 * inline math node (KaTeX renders it immediately).
 */
import { InputRule } from "@tiptap/core";
import { MathInline } from "./atoms";

export const MathInlineWithInput = MathInline.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$\n]+)\$$/,
        handler: ({ range, match, chain }) => {
          const tex = match[1];
          if (!tex) return;
          chain()
            .deleteRange(range)
            .insertContent({
              type: "mathInline",
              attrs: { tex, delim: "dollar" },
            })
            .run();
        },
      }),
    ];
  },
});
