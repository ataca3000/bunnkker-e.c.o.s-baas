import { useState } from 'react';
import { Search, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkflowTemplates, useCreateWorkflowFromTemplate } from '../hooks/use-workflow-templates';
import type { AutomationWorkflowTemplate, WorkflowTemplateCategory } from '../types/automation';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<WorkflowTemplateCategory, string> = {
  welcome_series:        '\u{1F44B}',
  abandoned_cart:        '\u{1F6D2}',
  lead_nurturing:        '\u{1F331}',
  no_reply_reminder:     '\u{1F4E9}',
  payment_reminder:      '\u{1F4B3}',
  shipment_notification: '\u{1F4E6}',
  order_delivered:       '\u{2705}',
  review_request:        '\u{2B50}',
  birthday_campaign:     '\u{1F382}',
  vip_upgrade:           '\u{1F451}',
  win_back_customer:     '\u{1F501}',
  seasonal_campaign:     '\u{1F31F}',
  ramadan_journey:       '\u{1F319}',
  black_friday_journey:  '\u{1F6CD}',
  product_launch:        '\u{1F680}',
  custom:                '\u{2699}',
};

function TemplateCard({ template, onUse }: { template: AutomationWorkflowTemplate; onUse: () => void }) {
  const { t } = useTranslation('marketing');

  return (
    <div className="bg-card border rounded-lg p-3 hover:border-primary transition-colors">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{CATEGORY_ICONS[template.category] ?? CATEGORY_ICONS.custom}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground">
            {t($ => $.automation.templateCategory[template.category], { defaultValue: template.category })}
          </p>
        </div>
        {template.is_global && (
          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex-shrink-0">
            {t($ => $.automation.templates.global)}
          </span>
        )}
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t($ => $.automation.templates.usedTimes, { count: template.usage_count })}
        </span>
        <Button size="sm" className="h-6 text-xs" onClick={onUse}>
          {t($ => $.automation.templates.use)}
        </Button>
      </div>
    </div>
  );
}

export function WorkflowTemplatePicker({ open, onClose }: Props) {
  const { t }                       = useTranslation('marketing');
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState<WorkflowTemplateCategory | undefined>();

  const { data, isLoading }         = useWorkflowTemplates({ search: search || undefined, category });
  const createFromTemplate          = useCreateWorkflowFromTemplate();

  const templates = data?.data ?? [];

  const categories = [...new Set(templates.map(tpl => tpl.category))] as WorkflowTemplateCategory[];

  async function handleUse(template: AutomationWorkflowTemplate) {
    await createFromTemplate.mutateAsync({ templateId: template.id, overrides: {} });
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t($ => $.automation.templates.title)}</SheetTitle>
        </SheetHeader>

        <div className="relative mt-4">
          <Search className="absolute start-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t($ => $.automation.templates.search)}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-8 h-8"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-3">
            <button
              onClick={() => setCategory(undefined)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                !category ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t($ => $.common.all)}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {CATEGORY_ICONS[cat]} {t($ => $.automation.templateCategory[cat], { defaultValue: cat })}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t($ => $.automation.templates.loading)}</div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Zap className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t($ => $.automation.templates.empty)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {templates.map(tpl => (
                <TemplateCard key={tpl.id} template={tpl} onUse={() => handleUse(tpl)} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
