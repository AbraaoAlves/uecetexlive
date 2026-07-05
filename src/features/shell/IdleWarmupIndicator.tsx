import { Loader2 } from "lucide-react";
import { strings } from "@/lib/strings";

export interface IdleWarmupIndicatorProps {
  loaded: number;
  total: number;
  /** Current asset name, or the "Iniciando motor…" phase label. */
  label: string;
}

/**
 * Discreet topbar note while the engine prefetches in the background (D12).
 * Once every byte is in, the label switches to the engine-boot phase text.
 */
export function IdleWarmupIndicator({ loaded, total, label }: IdleWarmupIndicatorProps) {
  const pct = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;
  const text =
    total > 0 && loaded >= total ? label : `${strings.topbar.idleWarmup} ${pct}%`;
  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-ink-subtle"
      data-testid="idle-warmup"
      title={strings.topbar.idleWarmupHint}
      aria-live="polite"
    >
      <Loader2 className="size-3 animate-spin" />
      {text}
    </span>
  );
}
