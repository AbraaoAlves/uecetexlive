import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckId, ComplianceCheck, ComplianceItem } from "./compliance-checklist";

export interface ComplianceTour {
  current: ComplianceItem | null;
  visited: ReadonlySet<string>;
  next: (checkId: CheckId) => ComplianceItem | null;
}

export function useComplianceTour(checks: readonly ComplianceCheck[]): ComplianceTour {
  const items = useMemo(() => checks.flatMap((check) => check.items ?? []), [checks]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set());
  const currentIdRef = useRef(currentId);
  const visitedRef = useRef(visited);

  currentIdRef.current = currentId;
  visitedRef.current = visited;

  useEffect(() => {
    const available = new Set(items.map((item) => item.id));
    const reconciled = new Set([...visitedRef.current].filter((id) => available.has(id)));
    if (reconciled.size !== visitedRef.current.size) {
      visitedRef.current = reconciled;
      setVisited(reconciled);
    }
    if (currentIdRef.current && !available.has(currentIdRef.current)) {
      currentIdRef.current = null;
      setCurrentId(null);
    }
  }, [items]);

  const next = useCallback(
    (checkId: CheckId): ComplianceItem | null => {
      const candidates = checks.find((check) => check.id === checkId)?.items ?? [];
      if (candidates.length === 0) return null;

      let candidate = candidates.find((item) => !visitedRef.current.has(item.id));
      if (!candidate) {
        const currentIndex = candidates.findIndex(
          (item) => item.id === currentIdRef.current,
        );
        candidate = candidates[(currentIndex + 1) % candidates.length];
      }
      if (!candidate) return null;

      const nextVisited = new Set(visitedRef.current);
      nextVisited.add(candidate.id);
      visitedRef.current = nextVisited;
      currentIdRef.current = candidate.id;
      setVisited(nextVisited);
      setCurrentId(candidate.id);
      return candidate;
    },
    [checks],
  );

  return {
    current: items.find((item) => item.id === currentId) ?? null,
    visited,
    next,
  };
}
