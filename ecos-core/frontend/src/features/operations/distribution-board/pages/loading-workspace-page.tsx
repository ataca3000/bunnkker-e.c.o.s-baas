import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import {
  useLoadingManifest,
  useStartManifest,
  useConfirmManifestItem,
  useResolveShortage,
  useCompleteManifest,
  useHandoverStatus,
  useDriverConfirmProduct,
  useAcceptDiscrepancy,
  useDriverConfirmCustody,
} from '../hooks/use-loading-manifest';
import { LoadingProductCard } from '../components/loading-product-card';
import { DriverProductConfirmation } from '../components/driver-product-confirmation';
import { DriverCustodyConfirmation } from '../components/driver-custody-confirmation';
import { ROUTES } from '@/router/routes';
import * as svc from '../services/distribution-board-service';

type Phase2Tab = 'products' | 'custody';

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-muted-foreground/30';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground min-w-[3rem] text-end">
        {value}/{max}
      </span>
    </div>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

export function LoadingWorkspacePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate   = useNavigate();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [phase2Tab, setPhase2Tab]       = useState<Phase2Tab>('products');
   

  // Step 1: resolve manifest ID from trip
  const manifestSummaryQ = useQuery({
    queryKey: ['distribution-trip-manifest-summary', tripId],
    queryFn: () => svc.fetchTripManifestSummary(tripId!),
    enabled: !!tripId,
  });

  const manifestId = manifestSummaryQ.data?.manifest?.id ?? null;

  // Step 2: warehouse manifest (Phase 1)
  const { data, isLoading, isError } = useLoadingManifest(manifestId);
  const startMutation    = useStartManifest(manifestId ?? 0);
  const confirmItem      = useConfirmManifestItem(manifestId ?? 0);
  const resolveShortage  = useResolveShortage(manifestId ?? 0);
  const completeManifest = useCompleteManifest(manifestId ?? 0);

  // Step 3: driver handover (Phase 2) — fetched once manifest is completed
  const manifest       = data?.manifest;
  const isPhase2       = manifest?.status === 'completed';
  const handoverQ      = useHandoverStatus(isPhase2 ? (tripId ?? null) : null);
  const driverConfirm  = useDriverConfirmProduct(manifestId ?? 0, tripId ?? '');
  const acceptDiscrep  = useAcceptDiscrepancy(manifestId ?? 0, tripId ?? '');
  const custodyConfirm = useDriverConfirmCustody(tripId ?? '');

  const handover = handoverQ.data;

  // Auto-start warehouse loading on mount
  useEffect(() => {
    if (manifest?.status === 'pending') {
      startMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest?.status]);

  // Auto-switch to driver handover tab once Phase 2 loads
  useEffect(() => {
    if (isPhase2 && handover && phase2Tab === 'products' && handover.custody.total === 0) {
      // If no custody items, start on products tab (already default)
    }
  }, [isPhase2, handover, phase2Tab]);

  const summaryLoading = manifestSummaryQ.isLoading;

  if (summaryLoading || (manifestId !== null && isLoading)) {
    return (
      <div className="flex flex-col h-full gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (manifestSummaryQ.data?.manifest === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Loading manifest has not been created yet.</p>
        <p className="text-xs text-muted-foreground/70">Approve the trip on the distribution board first.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.distributionBoard)}>
          Back to Distribution Board
        </Button>
      </div>
    );
  }

  if (isError || !manifest) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Package className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Loading manifest not found or access denied.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.distributionBoard)}>
          Back to Distribution Board
        </Button>
      </div>
    );
  }

  const pending     = manifest.items.filter((i) => i.status === 'pending');
  const confirmed   = manifest.items.filter((i) => i.status === 'confirmed');
  const shortages   = manifest.items.filter((i) => i.status === 'shortage');
  const unresolved  = shortages.filter((i) => !i.shortage_resolution);

  const statusBadge = {
    pending:     { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    in_progress: { label: 'Loading', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    completed:   { label: 'Loaded',  className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    cancelled:   { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  }[manifest.status] ?? { label: manifest.status, className: '' };

  const phase2Tabs: { id: Phase2Tab; label: string; badge?: number }[] = [
    {
      id: 'products',
      label: 'Receive Products',
      badge: handover?.manifest?.driver_pending,
    },
    {
      id: 'custody',
      label: 'Custody Handover',
      badge: handover ? handover.custody.total - handover.custody.confirmed : undefined,
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -ml-1"
          onClick={() => navigate(ROUTES.distributionBoard)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Loading Workspace</span>
            <span className="text-xs text-muted-foreground">Manifest #{manifest.id}</span>
            <Badge className={`text-xs h-4 px-1.5 ${statusBadge.className}`}>
              {statusBadge.label}
            </Badge>
            {isPhase2 && (
              <Badge className="text-xs h-4 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Driver Handover
              </Badge>
            )}
          </div>
          <ProgressBar
            value={confirmed.length + shortages.filter((s) => s.shortage_resolution).length}
            max={manifest.total_products}
          />
        </div>

        {/* KPI pills */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="text-xs px-2 py-1 rounded-md bg-muted border">
            <span className="text-muted-foreground">Products </span>
            <span className="font-semibold">{manifest.total_products}</span>
          </div>
          <div className="text-xs px-2 py-1 rounded-md bg-emerald-50 border-emerald-200 border dark:bg-emerald-950/20 dark:border-emerald-900/50">
            <span className="text-muted-foreground">Loaded </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{manifest.confirmed_products}</span>
          </div>
          {isPhase2 && handover && (
            <div className="text-xs px-2 py-1 rounded-md bg-amber-50 border-amber-200 border dark:bg-amber-950/20 dark:border-amber-900/50">
              <span className="text-muted-foreground">Driver </span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">{handover.manifest?.driver_confirmed ?? 0}/{manifest.total_products}</span>
            </div>
          )}
        </div>

        {/* Complete loading button — Phase 1 only */}
        {!isPhase2 && (
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={!manifest.can_complete || completeManifest.isPending}
            onClick={() => setCompleteOpen(true)}
          >
            {completeManifest.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            Complete Loading
          </Button>
        )}
      </div>

      {/* Phase 1: Warehouse loading */}
      {!isPhase2 && (
        <>
          {/* Live validation bar */}
          <div className="flex items-center gap-4 px-4 py-2 border-b text-xs bg-muted/30 shrink-0">
            <Indicator ok={confirmed.length > 0 || manifest.total_products === 0} label="Products Confirmed" />
            <Indicator ok={unresolved.length === 0} label="No Pending Shortages" />
            <Indicator ok={manifest.can_complete} label="Ready to Complete" />
            {!manifest.can_complete && pending.length > 0 && (
              <span className="text-muted-foreground ms-auto">
                {pending.length} product{pending.length !== 1 ? 's' : ''} still pending
              </span>
            )}
            {unresolved.length > 0 && (
              <span className="text-red-500 font-medium ms-auto">
                {unresolved.length} shortage{unresolved.length !== 1 ? 's' : ''} need resolution
              </span>
            )}
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {manifest.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No products in this manifest.</p>
                </div>
              ) : (
                <>
                  {pending.length > 0 && (
                    <section>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Awaiting Confirmation
                      </h4>
                      <div className="space-y-2">
                        {pending.map((item) => (
                          <LoadingProductCard
                            key={item.id}
                            manifestId={manifestId!}
                            item={item}
                            onConfirm={(itemId, qty) => confirmItem.mutate({ itemId, loadedQty: qty })}
                            onResolveShortage={(itemId, resolution, notes) =>
                              resolveShortage.mutate({ itemId, resolution, notes })
                            }
                            confirmPending={confirmItem.isPending}
                            shortageResolvePending={resolveShortage.isPending}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {shortages.length > 0 && (
                    <section>
                      <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">
                        Shortages
                      </h4>
                      <div className="space-y-2">
                        {shortages.map((item) => (
                          <LoadingProductCard
                            key={item.id}
                            manifestId={manifestId!}
                            item={item}
                            onConfirm={(itemId, qty) => confirmItem.mutate({ itemId, loadedQty: qty })}
                            onResolveShortage={(itemId, resolution, notes) =>
                              resolveShortage.mutate({ itemId, resolution, notes })
                            }
                            confirmPending={confirmItem.isPending}
                            shortageResolvePending={resolveShortage.isPending}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {confirmed.length > 0 && (
                    <section>
                      <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                        Confirmed ({confirmed.length})
                      </h4>
                      <div className="space-y-2">
                        {confirmed.map((item) => (
                          <LoadingProductCard
                            key={item.id}
                            manifestId={manifestId!}
                            item={item}
                            onConfirm={(itemId, qty) => confirmItem.mutate({ itemId, loadedQty: qty })}
                            onResolveShortage={(itemId, resolution, notes) =>
                              resolveShortage.mutate({ itemId, resolution, notes })
                            }
                            confirmPending={confirmItem.isPending}
                            shortageResolvePending={resolveShortage.isPending}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Phase 2: Driver Handover */}
      {isPhase2 && (
        <>
          {/* Phase 2 sub-nav */}
          <div className="flex border-b shrink-0 bg-muted/20">
            {phase2Tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPhase2Tab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  phase2Tab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-xs bg-amber-500 text-white">
                    {tab.badge}
                  </span>
                )}
                    </button>
            ))}
          </div>

          {/* Phase 2 loading */}
          {handoverQ.isLoading && (
            <div className="flex-1 p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!handoverQ.isLoading && handover && (
            <div className="flex-1 overflow-y-auto">
              {/* Dispatch Gate banner */}
              <div className="mx-4 mt-4 flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Loading Complete</div>
                  <div className="text-xs text-muted-foreground">
                    Proceed to the Dispatch Gate for official driver acceptance and vehicle dispatch authorization.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => navigate(`${ROUTES.dispatchGate}/${tripId}`)}
                >
                  Dispatch Gate
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-4">
                {phase2Tab === 'products' && handover.manifest && (
                  <DriverProductConfirmation
                    manifest={handover.manifest}
                    manifestId={manifestId!}
                    tripId={tripId!}
                    onConfirm={(itemId, qty) => driverConfirm.mutate({ itemId, receivedQty: qty })}
                    onAcceptDiscrepancy={(itemId, notes) => acceptDiscrep.mutate({ itemId, notes })}
                    confirmPending={driverConfirm.isPending}
                    acceptPending={acceptDiscrep.isPending}
                  />
                )}

                {phase2Tab === 'custody' && (
                  <DriverCustodyConfirmation
                    custody={handover.custody}
                    onConfirm={(custodyId, qty) => custodyConfirm.mutate({ custodyId, receivedQty: qty })}
                    confirmPending={custodyConfirm.isPending}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Complete Loading dialog */}
      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Loading?</AlertDialogTitle>
            <AlertDialogDescription>
              All {manifest.total_products} products have been processed.
              The trip will move to the <strong>Dispatch Gate</strong> for official driver acceptance
              and vehicle dispatch authorization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                completeManifest.mutate(undefined, { onSuccess: () => setCompleteOpen(false) })
              }
            >
              Complete Loading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
