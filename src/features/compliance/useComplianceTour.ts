import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CheckId,
  type ComplianceCheck,
  type ComplianceItem,
  effectiveItems,
} from "./compliance-checklist";

export interface ComplianceTour {
  current: ComplianceItem | null;
  visited: ReadonlySet<string>;
  next: (checkId: CheckId) => ComplianceItem | null;
  nextAll: () => ComplianceItem | null;
  visit: (itemId: string) => void;
}

export function useComplianceTour(checks: readonly ComplianceCheck[]): ComplianceTour {
  const items = useMemo(() => checks.flatMap(effectiveItems), [checks]);
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

  const advance = useCallback(
    (candidates: readonly ComplianceItem[]): ComplianceItem | null => {
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
    [],
  );

  const next = useCallback(
    (checkId: CheckId) => {
      const check = checks.find((candidate) => candidate.id === checkId);
      return check ? advance(effectiveItems(check)) : null;
    },
    [advance, checks],
  );

  const nextAll = useCallback(() => advance(items), [advance, items]);

  const visit = useCallback(
    (itemId: string) => {
      if (!items.some((item) => item.id === itemId)) return;
      const nextVisited = new Set(visitedRef.current);
      nextVisited.add(itemId);
      visitedRef.current = nextVisited;
      currentIdRef.current = itemId;
      setVisited(nextVisited);
      setCurrentId(itemId);
    },
    [items],
  );

  return {
    current: items.find((item) => item.id === currentId) ?? null,
    visited,
    next,
    nextAll,
    visit,
  };
}
