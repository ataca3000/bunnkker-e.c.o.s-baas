import { History, MapPin, Pencil, Warehouse } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Warehouse as WarehouseType } from '@/features/warehouses/types/warehouse';

type WarehouseDetailDrawerProps = {
  warehouse: WarehouseType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (warehouse: WarehouseType) => void;
};

function OverviewTab({ warehouse }: { warehouse: WarehouseType }) {
  const locationParts = [warehouse.address, warehouse.city, warehouse.country].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {locationParts.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
          <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p className="text-sm font-medium">{locationParts.join(', ')}</p>
          </div>
        </div>
      )}

      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono font-medium">{warehouse.code}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{warehouse.name}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Company</dt>
          <dd>{warehouse.company?.name ?? '—'}</dd>
        </div>
        {warehouse.city && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">City</dt>
              <dd>{warehouse.city}</dd>
            </div>
          </>
        )}
        {warehouse.country && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Country</dt>
              <dd>{warehouse.country}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-muted-foreground text-xs">
            {warehouse.created_at ? new Date(warehouse.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
        {warehouse.updated_at && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="text-muted-foreground text-xs">
              {new Date(warehouse.updated_at).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

const TABS_TRIGGER_CLS =
  'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs';

export function WarehouseDetailDrawer({
  warehouse,
  open,
  onOpenChange,
  onEdit,
}: WarehouseDetailDrawerProps) {
  if (!warehouse) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <SheetTitle className="sr-only">{warehouse.name} — Warehouse Details</SheetTitle>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5 flex-none pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg shrink-0">
              <Warehouse className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold leading-none truncate">{warehouse.name}</span>
                <Badge
                  variant={warehouse.is_active ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {warehouse.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <SheetDescription className="font-mono text-xs mt-0.5">{warehouse.code}</SheetDescription>
            </div>
          </div>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onEdit(warehouse)}
            >
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview">
            <div className="sticky top-0 z-10 bg-background border-b">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10 gap-0 p-0">
                <TabsTrigger value="overview" className={TABS_TRIGGER_CLS}>Overview</TabsTrigger>
                <TabsTrigger value="activity" className={TABS_TRIGGER_CLS}>Activity</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="m-0 px-6 py-5">
              <OverviewTab warehouse={warehouse} />
            </TabsContent>

            <TabsContent value="activity" className="m-0 px-6 py-5">
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
                  <History className="text-muted-foreground/50 size-7" />
                </div>
                <p className="font-medium">No activity recorded</p>
                <p className="text-muted-foreground max-w-xs text-xs">
                  Changes and actions performed on this warehouse will be tracked here.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
