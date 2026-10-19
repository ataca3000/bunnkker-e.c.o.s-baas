import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Bell, RefreshCw, Filter, Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ds/use-toast';

interface SettingsState {
  cache_ttl_minutes:          number;
  default_date_preset:        string;
  auto_refresh_interval:      number;
  default_per_page:           number;
  show_growth_indicators:     boolean;
  default_currency:           string;
  default_granularity:        'day' | 'week' | 'month';
  notify_overspend:           boolean;
  notify_sync_failure:        boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  cache_ttl_minutes:      15,
  default_date_preset:    'last_30d',
  auto_refresh_interval:  0,
  default_per_page:       25,
  show_growth_indicators: true,
  default_currency:       'USD',
  default_granularity:    'day',
  notify_overspend:       true,
  notify_sync_failure:    true,
};

const STORAGE_KEY = 'ecos_marketing_settings';

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function SettingRow({ label, description, children }: {
  label:       string;
  description?: string;
  children:    React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1 pt-2">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

export function MarketingSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [dirty, setDirty]       = useState(false);
  const { toast }               = useToast();
  const { t }                   = useTranslation('settings');

  function patch(update: Partial<SettingsState>) {
    setSettings((s) => ({ ...s, ...update }));
    setDirty(true);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setDirty(false);
      toast({
        title:       t($ => $.marketingSettings.toast.saved),
        description: t($ => $.marketingSettings.toast.savedDesc),
      });
    } catch {
      toast({ title: t($ => $.marketingSettings.toast.failed), variant: 'destructive' });
    }
  }

  function reset() {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            {t($ => $.marketingSettings.title)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t($ => $.marketingSettings.subtitle)}
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} className="flex-shrink-0">
            <Save className="h-3.5 w-3.5 mr-1.5" /> {t($ => $.marketingSettings.save)}
          </Button>
        )}
      </div>

      {/* Cache & Refresh */}
      <div className="rounded-lg border bg-card p-4">
        <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title={t($ => $.marketingSettings.sections.cache)} />
        <div className="divide-y">
          <SettingRow
            label={t($ => $.marketingSettings.rows.cacheTtl.label)}
            description={t($ => $.marketingSettings.rows.cacheTtl.desc)}
          >
            <Select
              value={String(settings.cache_ttl_minutes)}
              onValueChange={(v) => patch({ cache_ttl_minutes: Number(v) })}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{t($ => $.marketingSettings.options.ttl5)}</SelectItem>
                <SelectItem value="15">{t($ => $.marketingSettings.options.ttl15)}</SelectItem>
                <SelectItem value="30">{t($ => $.marketingSettings.options.ttl30)}</SelectItem>
                <SelectItem value="60">{t($ => $.marketingSettings.options.ttl60)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={t($ => $.marketingSettings.rows.autoRefresh.label)}
            description={t($ => $.marketingSettings.rows.autoRefresh.desc)}
          >
            <Select
              value={String(settings.auto_refresh_interval)}
              onValueChange={(v) => patch({ auto_refresh_interval: Number(v) })}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t($ => $.marketingSettings.options.off)}</SelectItem>
                <SelectItem value="5">{t($ => $.marketingSettings.options.interval300)}</SelectItem>
                <SelectItem value="15">{t($ => $.marketingSettings.options.ttl15)}</SelectItem>
                <SelectItem value="30">{t($ => $.marketingSettings.options.ttl30)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* Dashboard Preferences */}
      <div className="rounded-lg border bg-card p-4">
        <SectionHeader icon={<Clock className="h-4 w-4" />} title={t($ => $.marketingSettings.sections.preferences)} />
        <div className="divide-y">
          <SettingRow
            label={t($ => $.marketingSettings.rows.showGrowth.label)}
            description={t($ => $.marketingSettings.rows.showGrowth.desc)}
          >
            <Switch
              checked={settings.show_growth_indicators}
              onCheckedChange={(v) => patch({ show_growth_indicators: v })}
              aria-label={t($ => $.marketingSettings.rows.showGrowth.label)}
            />
          </SettingRow>

          <SettingRow
            label={t($ => $.marketingSettings.rows.defaultCurrency.label)}
            description={t($ => $.marketingSettings.rows.defaultCurrency.desc)}
          >
            <Select
              value={settings.default_currency}
              onValueChange={(v) => patch({ default_currency: v })}
            >
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">{t($ => $.marketingSettings.options.usd)}</SelectItem>
                <SelectItem value="EGP">{t($ => $.marketingSettings.options.egp)}</SelectItem>
                <SelectItem value="EUR">{t($ => $.marketingSettings.options.eur)}</SelectItem>
                <SelectItem value="GBP">{t($ => $.marketingSettings.options.gbp)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* Default Filters */}
      <div className="rounded-lg border bg-card p-4">
        <SectionHeader icon={<Filter className="h-4 w-4" />} title={t($ => $.marketingSettings.sections.filters)} />
        <div className="divide-y">
          <SettingRow
            label={t($ => $.marketingSettings.rows.defaultDateRange.label)}
            description={t($ => $.marketingSettings.rows.defaultDateRange.desc)}
          >
            <Select
              value={settings.default_date_preset}
              onValueChange={(v) => patch({ default_date_preset: v })}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t($ => $.marketingSettings.options.today)}</SelectItem>
                <SelectItem value="yesterday">{t($ => $.marketingSettings.options.yesterday)}</SelectItem>
                <SelectItem value="last_7d">{t($ => $.marketingSettings.options.last7)}</SelectItem>
                <SelectItem value="last_30d">{t($ => $.marketingSettings.options.last30)}</SelectItem>
                <SelectItem value="last_90d">{t($ => $.marketingSettings.options.last90)}</SelectItem>
                <SelectItem value="this_month">{t($ => $.marketingSettings.options.thisMonth)}</SelectItem>
                <SelectItem value="last_month">{t($ => $.marketingSettings.options.lastMonth)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={t($ => $.marketingSettings.rows.rowsPerPage.label)}
            description={t($ => $.marketingSettings.rows.rowsPerPage.desc)}
          >
            <Select
              value={String(settings.default_per_page)}
              onValueChange={(v) => patch({ default_per_page: Number(v) })}
            >
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={t($ => $.marketingSettings.rows.granularity.label)}
            description={t($ => $.marketingSettings.rows.granularity.desc)}
          >
            <Select
              value={settings.default_granularity}
              onValueChange={(v) => patch({ default_granularity: v as 'day' | 'week' | 'month' })}
            >
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t($ => $.marketingSettings.options.daily)}</SelectItem>
                <SelectItem value="week">{t($ => $.marketingSettings.options.weekly)}</SelectItem>
                <SelectItem value="month">{t($ => $.marketingSettings.options.monthly)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border bg-card p-4">
        <SectionHeader icon={<Bell className="h-4 w-4" />} title={t($ => $.marketingSettings.sections.alerts)} />
        <div className="divide-y">
          <SettingRow
            label={t($ => $.marketingSettings.rows.roasAlert.label)}
            description={t($ => $.marketingSettings.rows.roasAlert.desc)}
          >
            <Switch
              checked={settings.notify_overspend}
              onCheckedChange={(v) => patch({ notify_overspend: v })}
              aria-label={t($ => $.marketingSettings.rows.roasAlert.label)}
            />
          </SettingRow>

          <SettingRow
            label={t($ => $.marketingSettings.rows.budgetAlert.label)}
            description={t($ => $.marketingSettings.rows.budgetAlert.desc)}
          >
            <Switch
              checked={settings.notify_sync_failure}
              onCheckedChange={(v) => patch({ notify_sync_failure: v })}
              aria-label={t($ => $.marketingSettings.rows.budgetAlert.label)}
            />
          </SettingRow>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
          {t($ => $.marketingSettings.reset)}
        </Button>
        <Button onClick={save} disabled={!dirty}>
          <Save className="h-4 w-4 mr-2" /> {t($ => $.marketingSettings.save)}
        </Button>
      </div>
    </div>
  );
}
