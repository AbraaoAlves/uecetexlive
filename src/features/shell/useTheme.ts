/**
 * Applies the color theme by toggling `.dark` on <html> (the dormant dark
 * palette in styles.css). "system" follows the OS and live-updates when the
 * OS preference changes.
 */
import { useEffect } from "react";
import type { UiSettings } from "@/features/project/schema";

export type Theme = UiSettings["theme"];

export function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

export function useTheme(theme: Theme, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && prefersDark());
      root.classList.toggle("dark", dark);
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, ready]);
}
