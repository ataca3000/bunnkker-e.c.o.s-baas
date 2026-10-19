import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Factory,
  Landmark,
  Megaphone,
  Package,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';
import type { DashboardProfile } from './widget-definitions';
import { DEFAULT_WIDGET_ORDER } from './widget-definitions';

// ── Profile preset definition ──────────────────────────────────────────────

export interface ProfilePreset {
  label:       string;
  description: string;
  icon:        LucideIcon;
  /** Ordered list of all widget IDs for this profile. */
  widgetOrder: string[];
  /** Widget IDs that start collapsed. */
  collapsed:   string[];
  /** Widget IDs hidden by default (not shown until manually restored). */
  hidden:      string[];
}

// ── Presets ────────────────────────────────────────────────────────────────

export const PROFILE_PRESETS: Record<DashboardProfile, ProfilePreset> = {

  executive: {
    label:       'Executive (CEO)',
    description: 'Revenue, orders, and high-level business health',
    icon:        Briefcase,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['marketing-perf', 'shipping-logistics', 'analytics-workspace', 'ai-intelligence'],
    hidden:      [],
  },

  operations: {
    label:       'Operations Manager',
    description: 'Orders, shipping, preparation waves, and logistics',
    icon:        Factory,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['marketing-perf', 'analytics-workspace', 'ai-intelligence'],
    hidden:      [],
  },

  marketing: {
    label:       'Marketing Manager',
    description: 'Campaigns, ROAS, spend, and customer acquisition',
    icon:        Megaphone,
    widgetOrder: [
      'hero-kpis',
      'executive-brief',
      'quick-actions',
      'marketing-perf',
      'sales-revenue',
      'analytics-workspace',
      'shipping-logistics',
      'ai-intelligence',
    ],
    collapsed: ['sales-revenue', 'shipping-logistics', 'analytics-workspace', 'ai-intelligence'],
    hidden:    [],
  },

  warehouse: {
    label:       'Warehouse Manager',
    description: 'Inventory status, active trips, shipping, and COD',
    icon:        Package,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['marketing-perf', 'analytics-workspace', 'ai-intelligence'],
    hidden:      [],
  },

  finance: {
    label:       'Finance Manager',
    description: 'Revenue, gross profit, COD settlements, and financial health',
    icon:        Landmark,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['shipping-logistics', 'analytics-workspace', 'ai-intelligence'],
    hidden:      [],
  },

  manufacturing: {
    label:       'Manufacturing Manager',
    description: 'Production waves, materials consumption, and capacity',
    icon:        Wrench,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['marketing-perf', 'analytics-workspace', 'ai-intelligence'],
    hidden:      ['shipping-logistics'],
  },

  crm: {
    label:       'CRM Manager',
    description: 'Customer orders, acquisition metrics, and retention',
    icon:        Users,
    widgetOrder: DEFAULT_WIDGET_ORDER,
    collapsed:   ['shipping-logistics', 'analytics-workspace', 'ai-intelligence'],
    hidden:      [],
  },
};

// ── System Administrator (can see everything) ─────────────────────────────

export const ADMIN_PRESET: ProfilePreset = {
  label:       'System Administrator',
  description: 'Full visibility across all dashboard widgets',
  icon:        Settings,
  widgetOrder: DEFAULT_WIDGET_ORDER,
  collapsed:   ['analytics-workspace', 'ai-intelligence'],
  hidden:      [],
};
