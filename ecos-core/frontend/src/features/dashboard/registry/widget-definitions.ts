import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Brain,
  Megaphone,
  Sparkles,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

// ── Widget taxonomy ────────────────────────────────────────────────────────

export type WidgetCategory =
  | 'executive'
  | 'operations'
  | 'marketing'
  | 'analytics'
  | 'activity'
  | 'quick-actions'
  | 'ai';

export type WidgetSize = 'full' | 'two-thirds' | 'half' | 'third';

export type DashboardProfile =
  | 'executive'
  | 'operations'
  | 'marketing'
  | 'warehouse'
  | 'finance'
  | 'manufacturing'
  | 'crm';

// ── Widget metadata ────────────────────────────────────────────────────────

/**
 * A WidgetDefinition describes a dashboard widget's metadata.
 * The actual React component is registered separately in the workspace.
 * This separation allows the registry to be imported without pulling in
 * component trees, and lets future widgets self-register here.
 */
export interface WidgetDefinition {
  id:               string;
  title:            string;
  category:         WidgetCategory;
  description:      string;
  icon:             LucideIcon;
  iconColor:        string;           // Tailwind color class
  defaultSize:      WidgetSize;
  /** Intended auto-refresh interval in ms. Undefined = manual only. */
  refreshMs?:       number;
  defaultVisible:   boolean;
  defaultCollapsed: boolean;
  /**
   * Optional role allowlist. Undefined = visible in all profiles.
   * Hidden by default in profiles not listed here but can be shown manually.
   */
  roles?:           DashboardProfile[];
}

// ── Registry ───────────────────────────────────────────────────────────────

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {

  // ── Executive ────────────────────────────────────────────────────────────
  'hero-kpis': {
    id:               'hero-kpis',
    title:            'Command Overview',
    category:         'executive',
    description:      'Role-specific top-6 KPIs for immediate business health assessment',
    icon:             Zap,
    iconColor:        'text-amber-500',
    defaultSize:      'full',
    refreshMs:        30_000,
    defaultVisible:   true,
    defaultCollapsed: false,
  },
  'executive-brief': {
    id:               'executive-brief',
    title:            'AI Executive Brief',
    category:         'executive',
    description:      'Rule-based operational summary of up to 5 key business signals',
    icon:             Sparkles,
    iconColor:        'text-violet-500',
    defaultSize:      'full',
    refreshMs:        5 * 60_000,
    defaultVisible:   true,
    defaultCollapsed: false,
  },

  // ── Quick Actions ────────────────────────────────────────────────────────
  'quick-actions': {
    id:               'quick-actions',
    title:            'Quick Actions',
    category:         'quick-actions',
    description:      'One-click access to the 6 most common operational tasks',
    icon:             Zap,
    iconColor:        'text-amber-500',
    defaultSize:      'full',
    refreshMs:        undefined,
    defaultVisible:   true,
    defaultCollapsed: false,
  },

  // ── Operations ───────────────────────────────────────────────────────────
  'sales-revenue': {
    id:               'sales-revenue',
    title:            'Sales & Revenue',
    category:         'operations',
    description:      'Revenue, order counts, AOV, gross profit, and order pipeline',
    icon:             TrendingUp,
    iconColor:        'text-indigo-500',
    defaultSize:      'full',
    refreshMs:        30_000,
    defaultVisible:   true,
    defaultCollapsed: false,
  },
  'shipping-logistics': {
    id:               'shipping-logistics',
    title:            'Shipping & Logistics',
    category:         'operations',
    description:      'Delivery counts, failure rate, COD tracking, and avg delivery time',
    icon:             Truck,
    iconColor:        'text-cyan-500',
    defaultSize:      'full',
    refreshMs:        15_000,
    defaultVisible:   true,
    defaultCollapsed: true,
    roles:            ['executive', 'operations', 'warehouse', 'finance', 'manufacturing', 'crm'],
  },

  // ── Marketing ────────────────────────────────────────────────────────────
  'marketing-perf': {
    id:               'marketing-perf',
    title:            'Marketing Performance',
    category:         'marketing',
    description:      'Campaign spend, ROAS, CAC, conversion rate, and customer acquisition',
    icon:             Megaphone,
    iconColor:        'text-violet-500',
    defaultSize:      'full',
    refreshMs:        60_000,
    defaultVisible:   true,
    defaultCollapsed: true,
    roles:            ['executive', 'marketing', 'finance', 'crm'],
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  'analytics-workspace': {
    id:               'analytics-workspace',
    title:            'Analytics Workspace',
    category:         'analytics',
    description:      'Monthly revenue progress, trend charts, and performance analytics',
    icon:             BarChart3,
    iconColor:        'text-indigo-500',
    defaultSize:      'full',
    refreshMs:        undefined,     // Manual refresh — analytics are not real-time
    defaultVisible:   true,
    defaultCollapsed: true,
  },

  // ── AI (reserved) ────────────────────────────────────────────────────────
  'ai-intelligence': {
    id:               'ai-intelligence',
    title:            'AI Intelligence Layer',
    category:         'ai',
    description:      'Reserved for demand forecasting, inventory optimization, and predictive analytics',
    icon:             Brain,
    iconColor:        'text-violet-500',
    defaultSize:      'full',
    refreshMs:        undefined,
    defaultVisible:   true,
    defaultCollapsed: true,
  },

  // ── Future placeholders ───────────────────────────────────────────────────
  // Register future widgets here. The workspace will render them automatically
  // once a component is mapped in dashboard-page.tsx.
  //
  // 'inventory-widget':    { ... }
  // 'manufacturing-widget':{ ... }
  // 'crm-widget':          { ... }
  // 'accounting-widget':   { ... }
  // 'hr-widget':           { ... }
  // 'pos-widget':          { ... }
};

/** Canonical display order for the default (executive) layout. */
export const DEFAULT_WIDGET_ORDER: string[] = [
  'hero-kpis',
  'executive-brief',
  'quick-actions',
  'sales-revenue',
  'marketing-perf',
  'shipping-logistics',
  'analytics-workspace',
  'ai-intelligence',
];
