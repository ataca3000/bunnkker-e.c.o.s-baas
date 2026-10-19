import { useEffect, useState } from 'react';
import { Building2, User } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useOpenSession,
  useCloseSession,
  usePosCompanies,
  usePosWarehouses,
  usePosChannels,
} from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';
import { useAuthStore } from '@/features/auth/store/auth-store';

function detectDeviceType(): string {
  if (/Mobi|Android/i.test(navigator.userAgent)) return 'mobile';
  return 'browser';
}

type SessionDialogProps = {
  open: boolean;
  mode: 'open' | 'close';
  onOpenChange: (open: boolean) => void;
};

export function SessionDialog({ open, mode, onOpenChange }: SessionDialogProps) {
  const { sessionId } = usePosStore();
  const authUser = useAuthStore((s) => s.user);
  const openSession = useOpenSession();
  const closeSession = useCloseSession();

  const { data: companies = [], isLoading: companiesLoading } = usePosCompanies();
  const { data: allWarehouses = [], isLoading: warehousesLoading } = usePosWarehouses();
  const { data: allChannels = [] } = usePosChannels();

  const [companyId, setCompanyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [channelId, setChannelId] = useState('');

  // Filter warehouses and channels by selected company
  const warehouses = companyId
    ? allWarehouses.filter((w) => w.company_id === companyId)
    : allWarehouses;
  const channels = companyId
    ? allChannels.filter((c) => c.company_id === companyId)
    : allChannels;

  // Auto-select when only one option is available
  useEffect(() => {
    if (companies.length === 1 && companies[0] && !companyId) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  useEffect(() => {
    if (warehouses.length === 1 && warehouses[0] && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // Reset warehouse/channel when company changes
  useEffect(() => {
    setWarehouseId('');
    setChannelId('');
  }, [companyId]);

  // Reset all selections when dialog closes
  useEffect(() => {
    if (!open) {
      setCompanyId('');
      setWarehouseId('');
      setChannelId('');
    }
  }, [open]);

  async function handleOpen() {
    if (!companyId || !warehouseId) return;
    await openSession.mutateAsync({
      company_id:         companyId,
      channel_id:         channelId || undefined,
      warehouse_id:       warehouseId,
      device_fingerprint: navigator.userAgent.slice(0, 64),
      device_type:        detectDeviceType(),
    });
    onOpenChange(false);
  }

  async function handleClose() {
    if (!sessionId) return;
    await closeSession.mutateAsync(sessionId);
    onOpenChange(false);
  }

  // ── Close mode ────────────────────────────────────────────────────────────

  if (mode === 'close') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Session</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will close the current POS session. Make sure all shifts are approved first.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={closeSession.isPending}
              onClick={handleClose}
            >
              {closeSession.isPending ? 'Closing...' : 'Close Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Open mode ─────────────────────────────────────────────────────────────

  const isLoading = companiesLoading || warehousesLoading;
  const canOpen = !!companyId && !!warehouseId && !openSession.isPending;
  const deviceLabel = detectDeviceType() === 'mobile' ? 'Mobile' : 'Desktop';
  const singleCompany = companies.length === 1 ? companies[0] : null;
  const singleWarehouse = warehouses.length === 1 ? warehouses[0] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5" />
            <DialogTitle>Open POS Session</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cashier — read-only, resolved from authenticated user */}
          <div className="space-y-1.5">
            <Label>Cashier</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{authUser?.name ?? '—'}</span>
              <span className="ms-auto shrink-0 text-xs text-muted-foreground">Signed in</span>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <Label htmlFor="company-select">
              Company <span className="text-destructive">*</span>
            </Label>
            {isLoading ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : singleCompany ? (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{singleCompany.name}</span>
              </div>
            ) : (
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger id="company-select">
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Warehouse */}
          <div className="space-y-1.5">
            <Label htmlFor="warehouse-select">
              Warehouse <span className="text-destructive">*</span>
            </Label>
            {singleWarehouse ? (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{singleWarehouse.name}</span>
              </div>
            ) : (
              <Select value={warehouseId} onValueChange={setWarehouseId} disabled={!companyId}>
                <SelectTrigger id="warehouse-select">
                  <SelectValue
                    placeholder={companyId ? 'Select warehouse...' : 'Select company first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Sales Channel (optional — only shown when channels exist for this company) */}
          {channels.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="channel-select">
                Sales Channel
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger id="channel-select">
                  <SelectValue placeholder="Walk-in / No channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Walk-in / No channel</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                      <span className="ml-2 text-xs text-muted-foreground">{ch.platform_label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Device — auto-detected, read-only */}
          <div className="space-y-1.5">
            <Label>Device</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{deviceLabel}</span>
              <span className="ml-2 text-xs text-muted-foreground">Auto-detected</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canOpen}
            onClick={handleOpen}
          >
            {openSession.isPending ? 'Opening...' : 'Open Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
