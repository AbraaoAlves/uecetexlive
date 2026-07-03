import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

export interface SlashItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export interface SlashMenuListProps {
  items: SlashItem[];
}

export interface SlashMenuListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(
  function SlashMenuList({ items }, ref) {
    const [selected, setSelected] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on new results
    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % Math.max(1, items.length));
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % Math.max(1, items.length));
          return true;
        }
        if (event.key === "Enter") {
          items[selected]?.run();
          return true;
        }
        return false;
      },
    }));

    return (
      <div
        className="w-64 overflow-hidden rounded-md border bg-surface-elevated shadow-lg"
        data-testid="slash-menu"
      >
        {items.length === 0 ? (
          <div className="px-3 py-2 text-ink-subtle text-sm">Nenhum comando</div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              data-testid={`slash-item-${item.id}`}
              className={cn(
                "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm",
                i === selected ? "bg-accent-soft" : "hover:bg-surface",
              )}
              onMouseEnter={() => setSelected(i)}
              onClick={() => item.run()}
            >
              <span className="font-medium">/{item.id}</span>
              <span className="truncate text-ink-subtle text-xs">{item.label}</span>
            </button>
          ))
        )}
      </div>
    );
  },
);
