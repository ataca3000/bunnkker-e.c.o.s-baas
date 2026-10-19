import { useMemo } from 'react';

import { APP_MODULES, type AppModule } from '@/config/module-navigation';

import { useAuthorization } from './use-authorization';
import type { AuthorizationContext } from './types';

/**
 * Maps a UI module id to the org feature it belongs to (feature-flag gate). Modules not
 * listed here are always feature-available.
 */
const MODULE_FEATURE: Record<string, string> = {
  finance: 'accounting',
  manufacturing: 'manufacturing',
  crm: 'crm',
  marketing: 'marketing',
  shipping: 'shipping',
  logistics: 'shipping',
  engineering: 'ai_platform',
};

/**
 * Maps a UI module id to the permission-catalog domains that grant access to it. Used as
 * the fallback gate for permission-driven users who have no Role Template navigation
 * whitelist yet.
 */
const MODULE_DOMAINS: Record<string, string[]> = {
  inventory: ['inventory'],
  purchasing: ['purchasing'],
  commerce: ['sales', 'commerce'],
  pos: ['pos'],
  crm: ['crm'],
  customerEngagement: ['cep'],
  omnichannel: ['omnichannel'],
  marketing: ['marketing', 'bae'],
  operations: ['operations'],
  logistics: ['logistics'],
  shipping: ['logistics'],
  manufacturing: ['manufacturing'],
  finance: ['finance', 'accounting'],
  hr: ['hr'],
  administration: ['iam', 'organization', 'configuration'],
  engineering: ['engineering', 'claude_bridge', 'bae'],
  reports: ['reports'],
  core: ['organization'],
  // The executive board draws one panel per domain and gates each panel on that
  // domain's own permission, so the fallback gate is the union of what it reads:
  // a user with none of these would open an empty board. Templated users never
  // reach this branch — their navigation whitelist decides, and only the C-level
  // templates carry `executive`.
  executive: ['finance', 'crm', 'operations', 'inventory', 'purchasing'],
};

/** Always-visible modules (the home surface). */
const ALWAYS_VISIBLE = new Set(['dashboard']);

/**
 * Decide whether a module is visible to the current user (pure — testable without React).
 *
 * Gate order: (1) org feature flag → (2) system users see all → (3) always-visible →
 * (4) a Role Template navigation whitelist, when present, is AUTHORITATIVE → (5) otherwise
 * fall back to "has any permission in the module's domain".
 */
export function isModuleVisible(moduleId: string, ctx: AuthorizationContext): boolean {
  const feature = MODULE_FEATURE[moduleId];
  if (feature && ctx.featureFlags[feature] === false) {
    return false;
  }

  if (ctx.isSystem) {
    return true;
  }
  if (ALWAYS_VISIBLE.has(moduleId)) {
    return true;
  }

  if (ctx.navigation.length > 0) {
    return ctx.navigation.includes(moduleId);
  }

  const domains = MODULE_DOMAINS[moduleId] ?? [];
  return domains.some((domain) => ctx.permissions.some((p) => p.startsWith(`${domain}.`)));
}

/**
 * useNavigation (TASK-IAM-005) — the dynamic sidebar source. Returns the modules the
 * current user may see, filtered from the static module registry by feature flags +
 * effective navigation. No hardcoded per-user navigation; the sidebar builds itself.
 */
export function useNavigation(): {
  modules: AppModule[];
  canSeeModule: (id: string) => boolean;
} {
  const { context } = useAuthorization();

  return useMemo(() => {
    const modules = APP_MODULES.filter((mod) => isModuleVisible(mod.id, context));
    return {
      modules,
      canSeeModule: (id: string) => isModuleVisible(id, context),
    };
  }, [context]);
}
