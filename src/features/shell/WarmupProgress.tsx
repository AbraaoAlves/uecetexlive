export interface WarmupProgressProps {
  loaded: number;
  total: number;
  label: string;
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

export function WarmupProgress({ loaded, total, label }: WarmupProgressProps) {
  const fraction = total > 0 ? Math.min(1, loaded / total) : 0;
  return (
    <div
      className="flex w-64 flex-col gap-1"
      data-testid="warmup-progress"
      aria-live="polite"
    >
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span className="max-w-40 truncate">{label}</span>
        <span>
          {mb(loaded)} / {mb(total)} MB
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
