import { useCallback, useEffect, useState } from 'react';
import type { DashboardProfile } from '../registry/widget-definitions';
import { PROFILE_PRESETS } from '../registry/profile-presets';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceLayout {
  order:     string[];
  hidden:    string[];
  collapsed: string[];
}

// ── Persistence ────────────────────────────────────────────────────────────

const VERSION = 'v1';

function storageKey(profile: DashboardProfile): string {
  return `ecos-workspace:${VERSION}:${profile}`;
}

function loadLayout(profile: DashboardProfile): WorkspaceLayout {
  try {
    const raw = localStorage.getItem(storageKey(profile));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkspaceLayout>;
      if (
        Array.isArray(parsed.order) &&
        Array.isArray(parsed.hidden) &&
        Array.isArray(parsed.collapsed)
      ) {
        return parsed as WorkspaceLayout;
      }
    }
  } catch { /* ignore corrupt storage */ }
  return defaultLayout(profile);
}

function defaultLayout(profile: DashboardProfile): WorkspaceLayout {
  const p = PROFILE_PRESETS[profile];
  return {
    order:     [...p.widgetOrder],
    hidden:    [...p.hidden],
    collapsed: [...p.collapsed],
  };
}

function saveLayout(profile: DashboardProfile, layout: WorkspaceLayout): void {
  try { localStorage.setItem(storageKey(profile), JSON.stringify(layout)); } catch { /* ignore */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useWorkspaceLayout(profile: DashboardProfile) {
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadLayout(profile));

  // Reload layout when profile switches
  useEffect(() => {
    setLayout(loadLayout(profile));
  }, [profile]);

  const mutate = useCallback(
    (fn: (l: WorkspaceLayout) => WorkspaceLayout) => {
      setLayout((prev) => {
        const next = fn(prev);
        saveLayout(profile, next);
        return next;
      });
    },
    [profile],
  );

  // ── Show / Hide ──────────────────────────────────────────────────────────

  const hide = useCallback(
    (id: string) => mutate((l) => ({ ...l, hidden: [...new Set([...l.hidden, id])] })),
    [mutate],
  );

  const show = useCallback(
    (id: string) => mutate((l) => ({ ...l, hidden: l.hidden.filter((h) => h !== id) })),
    [mutate],
  );

  // ── Collapse / Expand ────────────────────────────────────────────────────

  const collapse = useCallback(
    (id: string) => mutate((l) => ({ ...l, collapsed: [...new Set([...l.collapsed, id])] })),
    [mutate],
  );

  const expand = useCallback(
    (id: string) => mutate((l) => ({ ...l, collapsed: l.collapsed.filter((c) => c !== id) })),
    [mutate],
  );

  const toggle = useCallback(
    (id: string) =>
      mutate((l) => ({
        ...l,
        collapsed: l.collapsed.includes(id)
          ? l.collapsed.filter((c) => c !== id)
          : [...l.collapsed, id],
      })),
    [mutate],
  );

  // ── Drag-to-reorder ──────────────────────────────────────────────────────

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      mutate((l) => {
        const order = [...l.order];
        const from  = order.indexOf(fromId);
        const to    = order.indexOf(toId);
        if (from === -1 || to === -1) return l;
        order.splice(from, 1);
        order.splice(to, 0, fromId);
        return { ...l, order };
      });
    },
    [mutate],
  );

  // ── Reset to profile defaults ────────────────────────────────────────────

  const reset = useCallback(() => {
    const fresh = defaultLayout(profile);
    setLayout(fresh);
    saveLayout(profile, fresh);
  }, [profile]);

  // ── Derived helpers ──────────────────────────────────────────────────────

  const isHidden    = useCallback((id: string) => layout.hidden.includes(id),    [layout.hidden]);
  const isCollapsed = useCallback((id: string) => layout.collapsed.includes(id), [layout.collapsed]);

  return {
    layout,
    hide,
    show,
    collapse,
    expand,
    toggle,
    reorder,
    reset,
    isHidden,
    isCollapsed,
  };
}
