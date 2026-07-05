import { Monitor, Moon, Sun } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { Theme } from "./useTheme";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

const LABEL: Record<Theme, string> = {
  system: "Tema: automático",
  light: "Tema: claro",
  dark: "Tema: escuro",
};

/** Cycles automático → claro → escuro. */
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (next: Theme) => void;
}) {
  const Icon = ICON[theme];
  return (
    <Tooltip content={LABEL[theme]}>
      <button
        type="button"
        data-testid="theme-toggle"
        data-theme={theme}
        aria-label={LABEL[theme]}
        className="rounded p-1.5 text-ink-muted hover:bg-accent-soft"
        onClick={() => onChange(NEXT[theme])}
      >
        <Icon className="size-4" />
      </button>
    </Tooltip>
  );
}
