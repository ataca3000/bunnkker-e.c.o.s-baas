import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cog,
  History,
  Loader2,
  Lock,
  Package,
  RotateCcw,
  Save,
  ShieldCheck,
  Truck,
  Users,
  Webhook,
  XCircle,
} from 'lucide-react';

import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Switch }   from '@/components/ui/switch';
import { useToast } from '@/components/ds/use-toast';
import { cn }       from '@/lib/utils';

import {
  useBrandAudit,
  useBrandPolicy,
  useUpdateBrandPolicy,
} from '../hooks/use-configuration';
import { useOrderStatuses } from '@/features/orders/hooks/use-order-statuses';
import {
  type ConfigAuditEntry,
  type PolicyGroup,
} from '../types/configuration';

// ── Policy meta ───────────────────────────────────────────────────────────────

type PolicyMeta = {
  icon:        React.ReactNode;
  description: string;
};

const POLICY_META: Record<PolicyGroup, PolicyMeta> = {
  pricing:      { icon: <ChevronRight className="h-4 w-4" />, description: 'Margin thresholds, discount limits, and price-review automation rules.' },
  preparation:  { icon: <Package      className="h-4 w-4" />, description: 'Wave generation strategy, batch sizes, and exception handling for daily preparation sessions.' },
  inventory:    { icon: <ClipboardList className="h-4 w-4" />, description: 'Stock reservation method, costing method, and negative-stock policies.' },
  manufacturing:{ icon: <Cog          className="h-4 w-4" />, description: 'Recipe versioning, BOM validation rules, and production cost tracking.' },
  order:        { icon: <ShieldCheck  className="h-4 w-4" />, description: 'Required fields, approval rules, and deposit policies for new orders.' },
  logistics:    { icon: <Truck        className="h-4 w-4" />, description: 'Vehicle assignment, partial delivery handling, and route optimization limits.' },
  crm:          { icon: <Users        className="h-4 w-4" />, description: 'Customer scoring thresholds, follow-up schedules, and loyalty program settings.' },
  marketing:    { icon: <ChevronRight className="h-4 w-4" />, description: 'UTM attribution, campaign conversion windows, and tracking settings.' },
  ai:           { icon: <Brain        className="h-4 w-4" />, description: 'AI confidence thresholds, auto-decision settings, and prediction rules.' },
  workflow:     { icon: <RotateCcw    className="h-4 w-4" />, description: 'Workflow mode for orders, preparation, and procurement processes.' },
  notification: { icon: <Bot         className="h-4 w-4" />, description: 'Notification channels (email, SMS, WhatsApp) and escalation timers.' },
  integration:  { icon: <Webhook     className="h-4 w-4" />, description: 'Third-party integration toggles for WooCommerce, Meta, and Google.' },
  security:     { icon: <ShieldCheck className="h-4 w-4" />, description: 'Session timeout, login attempts, and MFA configuration.' },
  numbering:    { icon: <ClipboardList className="h-4 w-4" />, description: 'Document number prefixes and sequence padding across all modules.' },
  approval:     { icon: <CheckCircle2 className="h-4 w-4" />, description: 'Approval requirements for prices, recipes, purchases, discounts, and refunds.' },
};

// ── Field definitions per group ───────────────────────────────────────────────

type FieldType = 'boolean' | 'number' | 'text' | 'select' | 'nullable-number' | 'radio' | 'row-matrix' | 'placeholder-role';

type FieldOption = { value: string; label: string; hint?: string };

type MatrixOption = { value: string; label: string };

type MatrixRow = {
  value:        string;
  label:        string;
  locked?:      boolean;
  lockLabel?:   string;
  options?:     MatrixOption[];
  multiSelect?: boolean;
};

type FieldDef = {
  key:         string;
  label:       string;
  hint?:       string;
  type:        FieldType;
  options?:    FieldOption[];
  rows?:       MatrixRow[];
  min?:        number;
  max?:        number;
  span?:       'full';
  visibleWhen?: (form: Record<string, unknown>) => boolean;
};

const GROUP_FIELDS: Partial<Record<PolicyGroup, FieldDef[]>> = {
  pricing: [
    { key: 'auto_price_review',        label: 'Auto Price Review',         type: 'boolean',  hint: 'Automatically trigger review when cost or recipe changes.' },
    { key: 'minimum_margin_pct',       label: 'Minimum Margin %',          type: 'number',   min: 0, max: 100 },
    {
      key: 'publishing_strategy', label: 'Publishing Strategy', type: 'radio', span: 'full',
      hint: 'Controls when approved prices are pushed to the product catalog, WooCommerce, and POS.',
      options: [
        { value: 'automatic',      label: 'Publish Automatically',   hint: 'Approved prices go live instantly.' },
        { value: 'approval_only',  label: 'Publish After Approval',  hint: 'Prices are staged and must be manually published.' },
      ],
    },
    { key: 'discount_type',            label: 'Discount Limit Type',       type: 'select',
      options: [{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed_amount', label: 'Fixed Amount' }],
      hint: 'How the maximum discount limit is expressed.',
    },
    { key: 'discount_value',           label: 'Maximum Discount Value',    type: 'number',   min: 0, hint: 'Maximum allowed discount per order. 0 = no limit.' },
    { key: 'required_approval_above',  label: 'Approval Threshold',  type: 'nullable-number', hint: 'Require manager approval when price change exceeds this value.', visibleWhen: (form) => String(form['publishing_strategy'] ?? '') === 'approval_only' },
    { key: '_approval_role',           label: 'Approval Role',             type: 'placeholder-role', hint: 'The role required to approve price changes. Coming in a future update.', visibleWhen: (form) => String(form['publishing_strategy'] ?? '') === 'approval_only' },
    { key: 'pending_review_threshold', label: 'Pending Review Alert',      type: 'number',   hint: 'Show dashboard alert when pending reviews exceed this count.', min: 1 },
    { key: 'price_expiration_days',    label: 'Price Expiry (days)',       type: 'nullable-number', hint: 'Auto-expire prices after this many days. Leave blank for no expiry.' },
  ],
  preparation: [
    { key: 'wave_generation',         label: 'Wave Generation',           type: 'select',  options: [{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'Manual' }] },
    { key: 'wave_priority',           label: 'Wave Priority',             type: 'select',  options: [{ value: 'fifo', label: 'FIFO (First In First Out)' }, { value: 'priority', label: 'Priority Based' }, { value: 'deadline', label: 'Deadline First' }] },
    { key: 'batch_size',              label: 'Default Batch Size',        type: 'number',  min: 1, max: 500 },
    { key: 'merge_orders',            label: 'Merge Orders in Wave',      type: 'boolean', hint: 'Group multiple orders into a single preparation unit.' },
    { key: 'split_orders',            label: 'Allow Order Splitting',     type: 'boolean', hint: 'Allow splitting large orders across multiple waves.' },
    { key: 'partial_preparation',     label: 'Allow Partial Preparation', type: 'boolean', hint: 'Allow waves to be completed with partial inventory.' },
    { key: 'negative_stock_handling', label: 'Negative Stock Handling',   type: 'select',  options: [{ value: 'block', label: 'Block (prevent)' }, { value: 'warn', label: 'Warn Only' }, { value: 'allow', label: 'Allow' }] },
    { key: 'packing_strategy',        label: 'Packing Strategy',          type: 'select',  options: [{ value: 'standard', label: 'Standard' }, { value: 'bulk', label: 'Bulk' }, { value: 'individual', label: 'Individual' }] },
    { key: 'exception_handling',      label: 'Exception Handling',        type: 'select',  options: [{ value: 'notify', label: 'Notify Only' }, { value: 'block', label: 'Block Completion' }, { value: 'auto_resolve', label: 'Auto Resolve' }] },
  ],
  inventory: [
    { key: 'allow_negative_stock',       label: 'Allow Negative Stock',         type: 'boolean', hint: 'Allow stock levels to go below zero.' },
    { key: 'reservation_method',         label: 'Reservation Method',           type: 'select',  options: [{ value: 'fifo', label: 'FIFO' }, { value: 'fefo', label: 'FEFO (Expiry)' }, { value: 'manual', label: 'Manual' }] },
    { key: 'costing_method',             label: 'Costing Method',               type: 'select',  options: [{ value: 'fifo', label: 'FIFO' }, { value: 'average', label: 'Weighted Average' }, { value: 'standard', label: 'Standard Cost' }] },
    { key: 'cycle_count_frequency_days', label: 'Cycle Count Frequency (days)', type: 'number',  min: 1, max: 365, hint: 'How often to trigger inventory cycle count reminders.' },
    { key: 'stock_alert_threshold_pct',  label: 'Low Stock Alert %',            type: 'number',  min: 1, max: 100, hint: 'Alert when stock falls below this percentage of reorder point.' },
    { key: 'auto_reorder',               label: 'Enable Auto Reorder',          type: 'boolean', hint: 'Automatically create purchase orders when stock reaches reorder point.' },
  ],
  manufacturing: [
    { key: 'recipe_version_policy',       label: 'Recipe Version Policy',       type: 'select',  options: [{ value: 'latest', label: 'Always Latest' }, { value: 'approved', label: 'Last Approved' }, { value: 'pinned', label: 'Pinned Version' }] },
    { key: 'recipe_approval_required',    label: 'Recipe Approval Required',    type: 'boolean', hint: 'Recipes must be approved before production use.' },
    { key: 'auto_manufacturing',          label: 'Auto Manufacturing',           type: 'boolean', hint: 'Automatically create production orders to meet demand.' },
    { key: 'bom_validation',              label: 'BOM Validation',               type: 'boolean', hint: 'Validate BOM components are available before production.' },
    { key: 'waste_rules_enabled',         label: 'Waste Rules Enabled',          type: 'boolean', hint: 'Track and account for production waste in cost calculations.' },
    { key: 'cost_refresh_on_production',  label: 'Refresh Cost After Production',type: 'boolean', hint: 'Update finished product cost immediately after each production run.' },
  ],
  order: [
    {
      key: 'source_entry_policies', label: 'Source Order Entry Policy', type: 'row-matrix', span: 'full',
      hint: 'Entry status per order source. Options are loaded from the Order Status registry. External sources preserve their incoming status.',
      rows: [
        {
          value: 'manual', label: 'Manual Orders',
          multiSelect: true,
          options: [
            { value: 'pending',          label: 'Pending' },
            { value: 'awaiting_payment', label: 'Awaiting Payment' },
            { value: 'processing',       label: 'Processing' },
            { value: 'confirmed',        label: 'Confirmed' },
          ],
        },
        {
          value: 'pos', label: 'POS Sales',
          options: [
            { value: 'processing',    label: 'Processing' },
            { value: 'confirm_order', label: 'Confirmed' },
          ],
        },
        { value: 'woocommerce', label: 'WooCommerce', locked: true, lockLabel: 'Preserve Incoming Status' },
        { value: 'public_api',  label: 'Public API',  locked: true, lockLabel: 'Preserve Incoming Status' },
      ],
    },
    {
      key: 'payment_proof_policy', label: 'Payment Proof Policy', type: 'row-matrix', span: 'full',
      hint: 'When a payment receipt or screenshot is required per payment method.',
      rows: [
        { value: 'cod',           label: 'Cash on Delivery', options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
        { value: 'instapay',      label: 'InstaPay',         options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
        { value: 'bank_transfer', label: 'Bank Transfer',    options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
        { value: 'mobile_wallet', label: 'Mobile Wallet',    options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
        { value: 'credit_card',   label: 'Credit Card',      options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
      ],
    },
    { key: 'auto_reserve_inventory',   label: 'Auto Reserve Inventory',   type: 'boolean', hint: 'Automatically reserve stock after a new order is created.' },
    { key: 'customer_matching_policy', label: 'Customer Matching Policy', type: 'select',
      hint: 'Controls how an order handles a phone number that already belongs to an existing customer. Orders are never rejected — only the customer resolution behaviour changes.',
      options: [
        { value: 'reuse_existing',    label: 'Reuse Existing Customer (Recommended)' },
        { value: 'warn_only',         label: 'Reuse + Warn (frontend shows a notice)' },
        { value: 'block_new_customer', label: 'Force Reuse (prevent creating a new profile)' },
        { value: 'always_create_new', label: 'Always Create New Customer' },
      ],
    },
    { key: 'require_phone',           label: 'Require Phone Number',        type: 'boolean' },
    { key: 'require_address',         label: 'Require Delivery Address',    type: 'boolean' },
    { key: 'customer_lookup_enabled', label: 'Customer Lookup Enabled',     type: 'boolean', hint: 'Enable phone-based customer lookup when creating orders.' },
    { key: 'deposit_policy',          label: 'Deposit Policy',              type: 'select',  options: [{ value: 'none', label: 'None' }, { value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }] },
    { key: 'discount_policy',         label: 'Discount Policy',             type: 'select',  options: [{ value: 'none', label: 'No Discounts' }, { value: 'open', label: 'Open Discounts' }, { value: 'manager_approval', label: 'Manager Approval' }] },
  ],
  logistics: [
    { key: 'vehicle_assignment',   label: 'Vehicle Assignment',       type: 'select',  options: [{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Automatic' }] },
    { key: 'driver_assignment',    label: 'Driver Assignment',        type: 'select',  options: [{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Automatic' }] },
    { key: 'max_stops_per_route',  label: 'Max Stops per Route',      type: 'number',  min: 1, max: 100 },
    { key: 'partial_delivery',     label: 'Allow Partial Delivery',   type: 'boolean', hint: 'Allow delivering part of an order when full delivery is not possible.' },
    { key: 'failed_delivery',      label: 'Failed Delivery Action',   type: 'select',  options: [{ value: 'return_to_warehouse', label: 'Return to Warehouse' }, { value: 'reschedule', label: 'Reschedule' }, { value: 'cancel', label: 'Cancel Order' }] },
  ],
  crm: [
    { key: 'vip_order_threshold',        label: 'VIP Order Threshold',          type: 'number', min: 1, hint: 'Orders above this value are flagged as VIP.' },
    { key: 'delivery_success_threshold', label: 'Delivery Success Target %',    type: 'number', min: 1, max: 100 },
    { key: 'follow_up_after_days',       label: 'Follow-up After (days)',       type: 'number', min: 1 },
    { key: 'loyalty_enabled',            label: 'Loyalty Program Enabled',      type: 'boolean' },
  ],
  marketing: [
    { key: 'default_utm_source',      label: 'Default UTM Source',         type: 'text', hint: 'e.g. ecos-erp' },
    { key: 'campaign_attribution',    label: 'Campaign Attribution Model', type: 'select', options: [{ value: 'last_click', label: 'Last Click' }, { value: 'first_click', label: 'First Click' }, { value: 'linear', label: 'Linear' }] },
    { key: 'conversion_window_days',  label: 'Conversion Window (days)',   type: 'number', min: 1, max: 365 },
  ],
  ai: [
    { key: 'confidence_threshold',   label: 'Confidence Threshold',     type: 'number', min: 0, max: 1, hint: 'Min confidence score (0-1) for AI recommendations.' },
    { key: 'auto_decision_enabled',  label: 'Auto Decision Enabled',    type: 'boolean', hint: 'Allow AI to make decisions automatically above the confidence threshold.' },
    { key: 'alert_threshold',        label: 'Alert Threshold',          type: 'number', min: 0, max: 1, hint: 'Show alerts when AI confidence drops below this value.' },
  ],
  workflow: [
    { key: 'order_workflow',       label: 'Order Workflow Mode',       type: 'select', options: [{ value: 'standard', label: 'Standard' }, { value: 'express', label: 'Express' }, { value: 'strict', label: 'Strict Approval' }] },
    { key: 'preparation_workflow', label: 'Preparation Workflow Mode', type: 'select', options: [{ value: 'standard', label: 'Standard' }, { value: 'lean', label: 'Lean' }, { value: 'strict', label: 'Strict' }] },
    { key: 'procurement_workflow', label: 'Procurement Workflow Mode', type: 'select', options: [{ value: 'standard', label: 'Standard' }, { value: 'strict', label: 'Strict Approval' }] },
  ],
  notification: [
    { key: 'email_enabled',             label: 'Email Notifications',         type: 'boolean' },
    { key: 'sms_enabled',               label: 'SMS Notifications',           type: 'boolean' },
    { key: 'whatsapp_enabled',          label: 'WhatsApp Notifications',      type: 'boolean' },
    { key: 'push_enabled',              label: 'Push Notifications',          type: 'boolean' },
    { key: 'escalation_after_minutes',  label: 'Escalation After (minutes)',  type: 'number', min: 5, hint: 'Escalate unresolved alerts after this many minutes.' },
  ],
  integration: [
    { key: 'woocommerce_enabled', label: 'WooCommerce Integration', type: 'boolean' },
    { key: 'meta_enabled',        label: 'Meta (Facebook) Integration', type: 'boolean' },
    { key: 'google_enabled',      label: 'Google Ads Integration', type: 'boolean' },
  ],
  security: [
    { key: 'session_timeout_minutes', label: 'Session Timeout (minutes)', type: 'number', min: 5, max: 1440 },
    { key: 'max_login_attempts',      label: 'Max Login Attempts',        type: 'number', min: 1, max: 20 },
    { key: 'mfa_enabled',             label: 'Enable MFA',               type: 'boolean' },
    { key: 'password_expiry_days',    label: 'Password Expiry (days)',    type: 'nullable-number', hint: 'Leave blank to disable password expiry.' },
  ],
  numbering: [
    { key: 'order_prefix',     label: 'Order Prefix',     type: 'text' },
    { key: 'invoice_prefix',   label: 'Invoice Prefix',   type: 'text' },
    { key: 'purchase_prefix',  label: 'Purchase Prefix',  type: 'text' },
    { key: 'session_prefix',   label: 'Session Prefix',   type: 'text' },
    { key: 'count_prefix',     label: 'Count Prefix',     type: 'text' },
    { key: 'transfer_prefix',  label: 'Transfer Prefix',  type: 'text' },
    { key: 'return_prefix',    label: 'Return Prefix',    type: 'text' },
    { key: 'sequence_padding', label: 'Sequence Padding', type: 'number', min: 1, max: 10, hint: 'Number of digits with zero-padding. 6 = 000001.' },
  ],
  approval: [
    { key: 'price_approval_required',     label: 'Price Approval Required',       type: 'boolean' },
    { key: 'recipe_approval_required',    label: 'Recipe Approval Required',      type: 'boolean' },
    { key: 'purchase_approval_threshold', label: 'Purchase Approval Threshold', type: 'nullable-number', hint: 'Require approval for purchases above this amount.' },
    { key: 'discount_approval_required',  label: 'Discount Approval Required',    type: 'boolean' },
    { key: 'refund_approval_required',    label: 'Refund Approval Required',      type: 'boolean' },
  ],
};

// ── Main Component ────────────────────────────────────────────────────────────

export function PolicyWorkspace({ brandId, group }: { brandId: string; group: PolicyGroup }) {
  const { toast } = useToast();
  const { t }    = useTranslation('settings');
  const tAny     = t as (key: string, opts?: Record<string, unknown>) => string;

  const { data,    isLoading }     = useBrandPolicy(brandId, group);
  const { data: audit = [] }       = useBrandAudit(brandId, 20);
  const { mutateAsync, isPending } = useUpdateBrandPolicy(brandId, group);

  const [form,    setForm]    = useState<Record<string, unknown>>({});
  const [reason,  setReason]  = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings as Record<string, unknown>);
      setIsDirty(false);
    }
  }, [data]);

  function setField(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  async function handleSave() {
    if (
      group === 'pricing' &&
      String(form['publishing_strategy'] ?? '') === 'approval_only' &&
      (form['required_approval_above'] === null || form['required_approval_above'] === undefined || form['required_approval_above'] === '')
    ) {
      toast({
        title:       t($ => $.policy.toast.approvalRequired),
        description: t($ => $.policy.toast.approvalRequiredDesc),
        type:        'error',
      });
      return;
    }
    try {
      await mutateAsync({ settings: form, reason: reason || undefined });
      setReason('');
      setIsDirty(false);
      toast({ title: tAny('policy.savedSuccessfully'), type: 'success' });
    } catch {
      toast({
        title:       t($ => $.policy.toast.saveFailed),
        description: t($ => $.policy.toast.saveFailedDesc),
        type:        'error',
      });
    }
  }

  const { data: orderStatuses } = useOrderStatuses();

  const meta = POLICY_META[group];

  // Phase 3: override source_entry_policies row options from the canonical OrderStatus enum (via API).
  const fields = useMemo(() => {
    const base = GROUP_FIELDS[group] ?? [];
    if (group !== 'order' || !orderStatuses) return base;

    return base.map((f) => {
      if (f.key !== 'source_entry_policies') return f;
      return {
        ...f,
        rows: f.rows?.map((row) => {
          if (row.locked) return row;
          const dynamicOptions = orderStatuses.entry_options[row.value];
          return dynamicOptions && dynamicOptions.length > 0
            ? { ...row, options: dynamicOptions }
            : row;
        }),
      };
    });
  }, [group, orderStatuses]);

  // Filter audit to only this group
  const groupAudit = audit.filter((e) => e.category === group).slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{tAny('policy.loading')}</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Order Price Protection — immutable accounting rule, shown only in pricing group */}
      {group === 'pricing' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-4 py-3 flex items-start gap-3">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {t($ => $.policy.banner.orderPriceProtection)}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
              {t($ => $.policy.banner.orderPriceProtectionDesc)}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {t($ => $.policy.banner.enforced)}
          </span>
        </div>
      )}

      {/* Policy info */}
      <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{tAny(`policy.descriptions.${group}`, { defaultValue: meta.description })}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {data?.configured ? (
            <>
              <Badge className="text-[10px] py-0 h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-2.5 w-2.5 me-1" />
                {t($ => $.policy.configuredVersion, { version: data?.version ?? 1 })}
              </Badge>
            </>
          ) : (
            <Badge className="text-[10px] py-0 h-5 bg-amber-50 text-amber-700 border-amber-200">
              <XCircle className="h-2.5 w-2.5 me-1" />
              {t($ => $.policy.usingDefaults)}
            </Badge>
          )}
        </div>
      </div>

      {/* Form fields */}
      {fields.length > 0 ? (
        <div className="space-y-1">
          <div className="grid sm:grid-cols-2 gap-4">
            {fields
              .filter((field) => !field.visibleWhen || field.visibleWhen(form))
              .map((field) => (
                <div key={field.key} className={field.span === 'full' ? 'sm:col-span-2' : ''}>
                  <PolicyField
                    field={field}
                    value={form[field.key]}
                    onChange={(v) => setField(field.key, v)}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t($ => $.policy.noSettings)}
        </p>
      )}

      {/* Save */}
      {fields.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="space-y-1">
            <Label className="text-xs">{t($ => $.policy.reasonPlaceholder)}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t($ => $.policy.reasonNote)}
              className="h-8 text-sm max-w-sm"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={isPending || !isDirty}
            size="sm"
            className="gap-2"
          >
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save    className="h-3.5 w-3.5" />
            }
            {isPending ? t($ => $.policy.saving) : isDirty ? t($ => $.policy.save) : t($ => $.policy.saved)}
          </Button>
        </div>
      )}

      {/* Audit mini timeline */}
      {groupAudit.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            {tAny('policy.recentChanges')}
          </p>
          <div className="space-y-1">
            {groupAudit.map((e) => (
              <AuditLine key={e.id} entry={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Policy Field ──────────────────────────────────────────────────────────────

function PolicyField({
  field,
  value,
  onChange,
}: {
  field:    FieldDef;
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const { t }    = useTranslation('settings');
  const tAny     = t as (key: string, opts?: Record<string, unknown>) => string;

  if (field.type === 'boolean') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={onChange}
          className="mt-0.5 scale-90 shrink-0"
        />
        <div className="min-w-0">
          <Label className="text-sm font-medium cursor-pointer leading-none" onClick={() => onChange(!value)}>
            {tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}
          </Label>
          {field.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
        </div>
      </div>
    );
  }

  if (field.type === 'radio' && field.options) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
        <div className="flex gap-2">
          {field.options.map((opt) => {
            const active = String(value ?? '') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2.5 text-start transition-colors',
                  active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-input',
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'mt-0.5 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0',
                    active ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )} />
                  <div>
                    <p className={cn('text-sm font-medium leading-none', active ? 'text-foreground' : 'text-muted-foreground')}>
                      {tAny(`policy.options.${field.key}.${opt.value}`, { defaultValue: opt.label })}
                    </p>
                    {opt.hint && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {tAny(`policy.optionHints.${field.key}.${opt.value}`, { defaultValue: opt.hint })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
      </div>
    );
  }

  if (field.type === 'row-matrix' && field.rows) {
    const matrix = (value as Record<string, string | string[]> | null | undefined) ?? {};
    return (
      <div className="space-y-2">
        <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
        <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
          {field.rows.map((row) => {
            const rowVal = matrix[row.value];
            return (
              <div key={row.value} className={cn('flex gap-3 px-3 bg-card', row.multiSelect ? 'items-start py-3' : 'items-center py-2.5')}>
                <span className="text-sm font-medium w-36 shrink-0 mt-0.5">{tAny(`policy.rowLabels.${field.key}.${row.value}`, { defaultValue: row.label })}</span>
                {row.locked ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-md px-2 py-1">
                    <Lock className="h-3 w-3 shrink-0" />
                    {tAny(`policy.lockLabels.${row.value}`, { defaultValue: row.lockLabel ?? t($ => $.policy.locked) })}
                  </span>
                ) : row.multiSelect ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {(row.options ?? []).map((opt) => {
                      const selected: string[] = Array.isArray(rowVal)
                        ? (rowVal as string[])
                        : rowVal ? [rowVal as string] : [];
                      const checked = selected.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selected, opt.value]
                                : selected.filter((v) => v !== opt.value);
                              onChange({ ...matrix, [row.value]: next });
                            }}
                            className="h-3 w-3 rounded border-input accent-primary"
                          />
                          {tAny(`policy.options.${field.key}.${opt.value}`, { defaultValue: opt.label })}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={String(Array.isArray(rowVal) ? (rowVal[0] ?? '') : (rowVal ?? (row.options?.[0]?.value ?? '')))}
                    onChange={(e) => onChange({ ...matrix, [row.value]: e.target.value })}
                    className="h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {(row.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {tAny(`policy.options.${field.key}.${opt.value}`, { defaultValue: opt.label })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'placeholder-role') {
    return (
      <div className="space-y-1 opacity-60">
        <div className="flex items-center gap-2">
          <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border">
            {t($ => $.policy.comingSoon)}
          </span>
        </div>
        <select
          disabled
          className="w-full h-8 text-sm rounded-md border border-input bg-muted/40 px-2 cursor-not-allowed text-muted-foreground"
        >
          <option>{tAny('policy.options.pricing_manager', { defaultValue: 'Pricing Manager' })}</option>
          <option>{tAny('policy.options.commercial_manager', { defaultValue: 'Commercial Manager' })}</option>
          <option>{tAny('policy.options.general_manager', { defaultValue: 'General Manager' })}</option>
        </select>
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {tAny(`policy.options.${field.key}.${opt.value}`, { defaultValue: opt.label })}
            </option>
          ))}
        </select>
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
      </div>
    );
  }

  if (field.type === 'nullable-number') {
    const isNull = value === null || value === undefined;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs flex-1">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={!isNull}
              onChange={(e) => onChange(e.target.checked ? 0 : null)}
              className="h-3 w-3 rounded"
            />
            {t($ => $.policy.enabled)}
          </label>
        </div>
        <Input
          type="number"
          value={isNull ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          disabled={isNull}
          placeholder={t($ => $.policy.notSet)}
          min={field.min}
          max={field.max}
          className="h-8 text-sm"
        />
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
        <Input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          min={field.min}
          max={field.max}
          className="h-8 text-sm"
        />
        {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
      </div>
    );
  }

  // text
  return (
    <div className="space-y-1">
      <Label className="text-xs">{tAny(`policy.fields.${field.key}`, { defaultValue: field.label })}</Label>
      <Input
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 text-sm"
        placeholder={t($ => $.policy.notSet)}
      />
      {field.hint && <p className="text-[11px] text-muted-foreground">{tAny(`policy.hints.${field.key}`, { defaultValue: field.hint })}</p>}
    </div>
  );
}

// ── Audit Line ────────────────────────────────────────────────────────────────

function AuditLine({ entry }: { entry: ConfigAuditEntry }) {
  const { t, i18n } = useTranslation('settings');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
        entry.action === 'create' ? 'bg-emerald-500' :
        entry.action === 'delete' ? 'bg-red-500' :
        'bg-blue-500'
      }`} />
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          {tAny(`policy.auditActions.${entry.action}`, { defaultValue: entry.action })}
        </span>
        {entry.actor_name && (
          <span className="text-muted-foreground ms-1">
            {tAny('policy.auditBy')} {entry.actor_name}
          </span>
        )}
        {entry.reason && <span className="text-muted-foreground italic ms-1">"{entry.reason}"</span>}
      </div>
      <span className="text-muted-foreground shrink-0 whitespace-nowrap">
        {new Date(entry.occurred_at).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
