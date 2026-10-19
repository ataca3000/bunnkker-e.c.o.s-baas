import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Layers,
  Loader2,
  RefreshCw,
  Waves,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToastStore } from '@/components/ds/use-toast';
import {
  usePreparationWave,
  useGenerateDemand,
  useAnalyzeMaterials,
  useApproveWave,
  useRecalculateWave,
} from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';
import { useWaveStatusLabels, WAVE_STATUS_COLORS } from '../hooks/use-operations-labels';

// ── Coming Soon pill ──────────────────────────────────────────────────────────

function ComingSoon() {
  const { t } = useTranslation('settings');
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground ml-2">
      {t($ => $.wave.comingSoonBadge)}
    </span>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground font-medium w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  title,
  description,
  action,
  actionLabel,
  loading,
  disabled,
  variant = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline';
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button
        size="sm"
        variant={variant}
        className="h-8 text-xs shrink-0"
        onClick={action}
        disabled={disabled || loading}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        {actionLabel}
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaveSettingsPage() {
  const { t } = useTranslation('settings');
  const waveId = useSelectedWaveId();
  const toast  = useToastStore((s) => s.toast);
  const { waveStatusLabel } = useWaveStatusLabels();

  const { data: wave, isLoading } = usePreparationWave(waveId);

  const generateDemand   = useGenerateDemand();
  const analyzeMaterials = useAnalyzeMaterials();
  const approveWave      = useApproveWave();
  const recalculate      = useRecalculateWave();

  const [notes, setNotes] = useState<string>('');
  const [notesChanged, setNotesChanged] = useState(false);

  // Sync notes from wave data
  if (wave && !notesChanged && notes === '' && wave.notes) {
    setNotes(wave.notes);
  }

  async function handleGenerateDemand() {
    if (!waveId) return;
    try {
      await generateDemand.mutateAsync(waveId);
      toast({ type: 'success', title: t($ => $.wave.toast.generateSuccess) });
    } catch {
      toast({ type: 'error', title: t($ => $.wave.toast.generateFail) });
    }
  }

  async function handleAnalyzeMaterials() {
    if (!waveId) return;
    try {
      await analyzeMaterials.mutateAsync(waveId);
      toast({ type: 'success', title: t($ => $.wave.toast.analyzeSuccess) });
    } catch {
      toast({ type: 'error', title: t($ => $.wave.toast.analyzeFail) });
    }
  }

  async function handleApprove() {
    if (!waveId) return;
    try {
      await approveWave.mutateAsync({ id: waveId, payload: { notes: notes || undefined } });
      toast({ type: 'success', title: t($ => $.wave.toast.approveSuccess) });
    } catch {
      toast({ type: 'error', title: t($ => $.wave.toast.approveFail) });
    }
  }

  async function handleRecalculate() {
    if (!waveId) return;
    try {
      await recalculate.mutateAsync({ id: waveId, payload: {} });
      toast({ type: 'success', title: t($ => $.wave.toast.recalcSuccess) });
    } catch {
      toast({ type: 'error', title: t($ => $.wave.toast.recalcFail) });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {!waveId ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Waves className="h-8 w-8 opacity-30" />
          <p className="text-sm">{t($ => $.wave.emptyState)}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t($ => $.wave.loading)}</span>
        </div>
      ) : !wave ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">{t($ => $.wave.notFound)}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="h-8">
              <TabsTrigger value="general" className="text-xs">{t($ => $.wave.tabs.general)}</TabsTrigger>
              <TabsTrigger value="automation" className="text-xs">{t($ => $.wave.tabs.automation)}</TabsTrigger>
            </TabsList>

            {/* ── General tab ─────────────────────────────────────────────── */}
            <TabsContent value="general" className="mt-0 space-y-5">
              <div className="rounded-lg border border-border/60 bg-card px-4 py-1">
                <InfoRow label={t($ => $.wave.info.waveNumber)}   value={<span className="font-mono font-medium">{wave.wave_number}</span>} />
                <InfoRow label={t($ => $.wave.info.status)}       value={<Badge className={`text-xs ${WAVE_STATUS_COLORS[wave.status]}`}>{waveStatusLabel[wave.status]}</Badge>} />
                <InfoRow label={t($ => $.wave.info.planningDate)} value={new Date(wave.planning_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <InfoRow label={t($ => $.wave.info.warehouseId)}  value={<span className="font-mono text-xs text-muted-foreground">{wave.warehouse_id}</span>} />
                <InfoRow label={t($ => $.wave.info.orders)}       value={wave.orders_count} />
                <InfoRow label={t($ => $.wave.info.products)}     value={wave.products_count} />
                <InfoRow label={t($ => $.wave.info.completion)}   value={`${wave.completion_pct.toFixed(1)}%`} />
                {wave.approved_at && (
                  <InfoRow
                    label={t($ => $.wave.info.approvedAt)}
                    value={new Date(wave.approved_at).toLocaleString()}
                  />
                )}
                {wave.started_at && (
                  <InfoRow
                    label={t($ => $.wave.info.startedAt)}
                    value={new Date(wave.started_at).toLocaleString()}
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t($ => $.wave.notes.title)}
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesChanged(true); }}
                  placeholder={t($ => $.wave.notes.placeholder)}
                  rows={4}
                  className="text-sm resize-none"
                />
                {notesChanged && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    {t($ => $.wave.notes.hint)}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ── Automation tab ──────────────────────────────────────────── */}
            <TabsContent value="automation" className="mt-0">
              <div className="rounded-lg border border-border/60 bg-card px-4 py-1 space-y-0">
                <ActionRow
                  icon={<Layers className="h-4 w-4" />}
                  title={t($ => $.wave.actions.generateDemand.title)}
                  description={t($ => $.wave.actions.generateDemand.desc)}
                  action={handleGenerateDemand}
                  actionLabel={t($ => $.wave.actions.generateDemand.button)}
                  loading={generateDemand.isPending}
                  disabled={wave.status === 'cancelled' || wave.status === 'completed'}
                />
                <ActionRow
                  icon={<FlaskConical className="h-4 w-4" />}
                  title={t($ => $.wave.actions.analyzeMaterials.title)}
                  description={t($ => $.wave.actions.analyzeMaterials.desc)}
                  action={handleAnalyzeMaterials}
                  actionLabel={t($ => $.wave.actions.analyzeMaterials.button)}
                  loading={analyzeMaterials.isPending}
                  disabled={wave.status === 'cancelled' || wave.status === 'completed'}
                />
                <ActionRow
                  icon={<RefreshCw className="h-4 w-4" />}
                  title={t($ => $.wave.actions.recalculate.title)}
                  description={t($ => $.wave.actions.recalculate.desc)}
                  action={handleRecalculate}
                  actionLabel={t($ => $.wave.actions.recalculate.button)}
                  loading={recalculate.isPending}
                  disabled={wave.status === 'cancelled'}
                />
                <ActionRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title={t($ => $.wave.actions.approve.title)}
                  description={t($ => $.wave.actions.approve.desc)}
                  action={handleApprove}
                  actionLabel={t($ => $.wave.actions.approve.button)}
                  loading={approveWave.isPending}
                  disabled={wave.status !== 'completed'}
                />
              </div>

              <div className="mt-4 rounded-lg border border-border/40 bg-muted/30 px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t($ => $.wave.automation.title)} <ComingSoon />
                </p>
                <p className="text-xs text-muted-foreground">
                  {t($ => $.wave.automation.desc)}
                </p>
                <div className="flex items-center gap-2 opacity-40">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">{t($ => $.wave.automation.autoGenerateDemand)}</span>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">{t($ => $.wave.automation.autoAnalyzeMaterials)}</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
