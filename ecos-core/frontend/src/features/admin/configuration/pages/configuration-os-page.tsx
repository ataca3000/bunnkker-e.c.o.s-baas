import { useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Brain,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Globe,
  Layers,
  Lock,
  Package,
  Settings,
  Shield,
  Users,
  Zap,
  Loader2,
  Bell,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBrandsQuery } from '@/features/brands/hooks/use-brands';
import { ROUTES }         from '@/router/routes';

type ConfigCategory = {
  key: string;
  icon: LucideIcon;
  color: string;
  policyGroup?: string;
};

const CATEGORIES: ConfigCategory[] = [
  {
    key:   'windows',
    icon:  Clock,
    color: 'text-violet-600 bg-violet-50',
  },
  {
    key:         'preparation',
    icon:        Package,
    color:       'text-orange-600 bg-orange-50',
    policyGroup: 'preparation',
  },
  {
    key:         'inventory',
    icon:        Box,
    color:       'text-teal-600 bg-teal-50',
    policyGroup: 'inventory',
  },
  {
    key:         'manufacturing',
    icon:        Cpu,
    color:       'text-cyan-600 bg-cyan-50',
    policyGroup: 'manufacturing',
  },
  {
    key:         'logistics',
    icon:        Globe,
    color:       'text-sky-600 bg-sky-50',
    policyGroup: 'logistics',
  },
  {
    key:         'crm',
    icon:        Users,
    color:       'text-rose-600 bg-rose-50',
    policyGroup: 'crm',
  },
  {
    key:         'marketing',
    icon:        Zap,
    color:       'text-pink-600 bg-pink-50',
    policyGroup: 'marketing',
  },
  {
    key:         'ai',
    icon:        Brain,
    color:       'text-purple-600 bg-purple-50',
    policyGroup: 'ai',
  },
  {
    key:         'workflow',
    icon:        Workflow,
    color:       'text-amber-600 bg-amber-50',
    policyGroup: 'workflow',
  },
  {
    key:         'notification',
    icon:        Bell,
    color:       'text-yellow-600 bg-yellow-50',
    policyGroup: 'notification',
  },
  {
    key:         'integration',
    icon:        Layers,
    color:       'text-slate-600 bg-slate-50',
    policyGroup: 'integration',
  },
  {
    key:         'security',
    icon:        Shield,
    color:       'text-red-600 bg-red-50',
    policyGroup: 'security',
  },
  {
    key:         'numbering',
    icon:        Settings,
    color:       'text-gray-600 bg-gray-50',
    policyGroup: 'numbering',
  },
  {
    key:         'approval',
    icon:        CheckCircle2,
    color:       'text-lime-600 bg-lime-50',
    policyGroup: 'approval',
  },
];

export function ConfigurationOsPage() {
  const { t } = useTranslation('settings');
  const navigate  = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  const { data: brandsData, isLoading: brandsLoading } = useBrandsQuery({
    per_page: 100,
    status:   'active',
  });

  const brands = brandsData?.items ?? [];

  const filtered = search
    ? CATEGORIES.filter(
        (c) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t($ => $.configOs.cat[c.key].label as any) as string).toLowerCase().includes(search.toLowerCase()) ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t($ => $.configOs.cat[c.key].desc as any) as string).toLowerCase().includes(search.toLowerCase()),
      )
    : CATEGORIES;

  function handleCategoryClick(cat: ConfigCategory) {
    if (!selectedBrandId) return;
    navigate(generatePath(ROUTES.configurationBrand, { brandId: selectedBrandId }) + `?tab=${cat.key}`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{t($ => $.configOs.title)}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t($ => $.configOs.subtitle)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t($ => $.configOs.auditEnabled)}</span>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <KpiCard icon={<Building2 className="h-4 w-4" />} label={t($ => $.configOs.kpi.areas)} value={CATEGORIES.length} />
          <KpiCard icon={<Layers      className="h-4 w-4" />} label={t($ => $.configOs.kpi.brands)}     value={brands.length} />
          <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label={t($ => $.configOs.kpi.audit)}     value={t($ => $.configOs.kpi.yes)} />
          <KpiCard icon={<Zap         className="h-4 w-4" />} label={t($ => $.configOs.kpi.cacheTtl)}   value={t($ => $.configOs.kpi.oneHour)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Brand Selector */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t($ => $.configOs.selectBrand)}
          </h2>
          {brandsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t($ => $.configOs.loadingBrands)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrandId(b.id === selectedBrandId ? null : b.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedBrandId === b.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border/60 hover:bg-muted/50'
                  }`}
                >
                  {b.name}
                  {selectedBrandId === b.id && <span className="ml-1.5 text-xs opacity-75">{t($ => $.configOs.selected)}</span>}
                </button>
              ))}
            </div>
          )}
          {!selectedBrandId && brands.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t($ => $.configOs.selectBrandWorkspace as any)}
            </p>
          )}
        </section>

        {/* Company Configuration */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {t($ => $.configOs.companyConfig)}
          </h2>
          <button
            onClick={() => navigate(ROUTES.configurationCompany)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors text-start"
          >
            <span className={`p-2 rounded-lg text-blue-600 bg-blue-50`}>
              <Building2 className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t($ => $.configOs.companySettings)}</div>
              <div className="text-xs text-muted-foreground">{t($ => $.configOs.companySettingsDesc)}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </section>

        {/* Brand Configuration Categories */}
        {selectedBrandId && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                {t($ => $.configOs.brandSettings)}
                <Badge className="text-xs bg-primary/10 text-primary border-0">
                  {brands.find((b) => b.id === selectedBrandId)?.name}
                </Badge>
              </h2>
              <Input
                placeholder={t($ => $.configOs.searchCategories)}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((cat) => (
                <CategoryCard
                  key={cat.key}
                  cat={cat}
                  onClick={() => handleCategoryClick(cat)}
                />
              ))}
            </div>
          </section>
        )}

        {!selectedBrandId && brands.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Settings className="h-10 w-10 opacity-30" />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <p className="text-sm">{t($ => $.configOs.selectBrandCategories as any)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ cat, onClick }: { cat: ConfigCategory; onClick: () => void }) {
  const { t } = useTranslation('settings');
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 hover:border-border transition-colors text-start w-full"
    >
      <span className={`p-2 rounded-lg shrink-0 ${cat.color}`}>
        <cat.icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <div className="text-sm font-medium">{t($ => $.configOs.cat[cat.key].label as any)}</div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <div className="text-xs text-muted-foreground truncate">{t($ => $.configOs.cat[cat.key].desc as any)}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div>
        <div className="text-base font-bold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}
