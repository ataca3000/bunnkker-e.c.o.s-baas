import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CoverageArea, CoverageAreaPayload } from '@/features/branches/types/branch';

type MasterGovernorate = { id: string; name: string; name_ar: string };
type MasterZone = { id: string; name: string };

async function fetchGovernorates(): Promise<MasterGovernorate[]> {
  const { data } = await api.get<{ data: MasterGovernorate[] }>('/configuration/master-geography');
  return data.data;
}

async function fetchZones(govId: string): Promise<MasterZone[]> {
  const { data } = await api.get<{ data: MasterZone[] }>(`/configuration/master-geography/${govId}/zones`);
  return data.data;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: CoverageArea | null;
  onSave: (payload: CoverageAreaPayload) => void;
  isPending: boolean;
};

export function CoverageAreaDialog({ open, onOpenChange, area, onSave, isPending }: Props) {
  const isEdit = area !== null;

  const [govId, setGovId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');
  const [priority, setPriority] = useState<number>(100);
  const [isActive, setIsActive] = useState<boolean>(true);

  const { data: governorates = [], isLoading: loadingGovs } = useQuery({
    queryKey: ['master-geography'],
    queryFn: fetchGovernorates,
    staleTime: 5 * 60 * 1000,
  });

  const { data: zones = [], isLoading: loadingZones } = useQuery({
    queryKey: ['master-geography', govId, 'zones'],
    queryFn: () => fetchZones(govId),
    enabled: !!govId,
    staleTime: 5 * 60 * 1000,
  });

  const [prevOpen, setPrevOpen] = useState(false);
  const [prevArea, setPrevArea] = useState<CoverageArea | null>(null);
  if (prevOpen !== open || prevArea !== area) {
    setPrevOpen(open);
    setPrevArea(area);
    if (open) {
      setGovId(area?.master_governorate_id ?? '');
      setZoneId(area?.master_zone_id ?? '');
      setPriority(area?.priority ?? 100);
      setIsActive(area?.is_active ?? true);
    }
  }

  // Reset zone when governorate changes (except when loading from existing area)
  const handleGovChange = (id: string) => {
    setGovId(id);
    if (id !== area?.master_governorate_id) {
      setZoneId('');
    }
  };

  const handleSubmit = () => {
    if (!govId) return;
    onSave({
      master_governorate_id: govId,
      master_zone_id: zoneId || null,
      priority,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Coverage Area' : 'Add Coverage Area'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="governorate">Governorate *</Label>
            <select
              id="governorate"
              value={govId}
              onChange={(e) => handleGovChange(e.target.value)}
              disabled={loadingGovs}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {loadingGovs ? 'Loading…' : 'Select governorate'}
              </option>
              {governorates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.name_ar ? `/ ${g.name_ar}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zone">
              Zone{' '}
              <span className="text-muted-foreground text-xs">(optional — leave blank to cover entire governorate)</span>
            </Label>
            <select
              id="zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={!govId || loadingZones}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {!govId
                  ? 'Select governorate first'
                  : loadingZones
                    ? 'Loading zones…'
                    : zones.length === 0
                      ? 'No zones available'
                      : 'Entire governorate'}
              </option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">
              Priority{' '}
              <span className="text-muted-foreground text-xs">(lower = higher priority)</span>
            </Label>
            <input
              id="priority"
              type="number"
              min={1}
              max={9999}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!govId || isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Coverage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
