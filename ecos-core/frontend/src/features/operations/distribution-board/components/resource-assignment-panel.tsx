import { User, Truck, Package } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAssignCarrier, useAssignDriver, useAssignVehicle, useFleetResources } from '../hooks/use-distribution-board';
import type { DistributionTrip } from '../types/distribution-board';

interface ResourceAssignmentPanelProps {
  trip: DistributionTrip;
}

const NULL_VALUE = '__null__';

export function ResourceAssignmentPanel({ trip }: ResourceAssignmentPanelProps) {
  const { money } = useFormatter();
  const { drivers, vehicles, carriers } = useFleetResources();
  const assignDriver  = useAssignDriver();
  const assignVehicle = useAssignVehicle();
  const assignCarrier = useAssignCarrier();

  function handleDriverSelect(val: string) {
    const id = val === NULL_VALUE ? null : Number(val);
    assignDriver.mutate({ tripId: trip.id, payload: { fleet_driver_id: id } });
  }

  function handleVehicleSelect(val: string) {
    const id = val === NULL_VALUE ? null : Number(val);
    assignVehicle.mutate({ tripId: trip.id, vehicleId: id });
  }

  function handleCarrierSelect(val: string) {
    const id = val === NULL_VALUE ? null : Number(val);
    assignCarrier.mutate({ tripId: trip.id, carrierId: id });
  }

  return (
    <div className="space-y-2.5">
      {/* Driver — shown for all trip types */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <User className="h-3 w-3" /> Driver
        </Label>
        {trip.type === 'personal_vehicle' ? (
          <div className="space-y-1">
            <Input
              className="h-7 text-xs"
              placeholder="Driver name"
              defaultValue={trip.driver_name ?? ''}
              onBlur={(e) =>
                assignDriver.mutate({
                  tripId: trip.id,
                  payload: { fleet_driver_id: null, driver_name: e.target.value || null },
                })
              }
            />
            <Input
              className="h-7 text-xs"
              placeholder="Phone"
              defaultValue={trip.driver_phone ?? ''}
              onBlur={(e) =>
                assignDriver.mutate({
                  tripId: trip.id,
                  payload: { fleet_driver_id: null, driver_phone: e.target.value || null },
                })
              }
            />
          </div>
        ) : (
          <Select
            value={trip.fleet_driver_id?.toString() ?? NULL_VALUE}
            onValueChange={handleDriverSelect}
            disabled={drivers.isLoading || assignDriver.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select driver…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_VALUE} className="text-xs text-muted-foreground">— Unassigned —</SelectItem>
              {drivers.data?.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()} className="text-xs">
                  {d.name_en}
                  {d.status !== 'available' && (
                    <span className="ml-1 text-amber-600">({d.status})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Vehicle — company trips only */}
      {trip.type === 'company_vehicle' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Truck className="h-3 w-3" /> Vehicle
          </Label>
          <Select
            value={trip.fleet_vehicle_id?.toString() ?? NULL_VALUE}
            onValueChange={handleVehicleSelect}
            disabled={vehicles.isLoading || assignVehicle.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select vehicle…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_VALUE} className="text-xs text-muted-foreground">— Unassigned —</SelectItem>
              {vehicles.data?.map((v) => (
                <SelectItem key={v.id} value={v.id.toString()} className="text-xs">
                  {v.display_name || v.plate_number}
                  {v.status !== 'available' && (
                    <span className="ml-1 text-amber-600">({v.status})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Carrier — external trips only */}
      {trip.type === 'external_carrier' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3 w-3" /> Carrier
          </Label>
          <Select
            value={trip.external_carrier_id?.toString() ?? NULL_VALUE}
            onValueChange={handleCarrierSelect}
            disabled={carriers.isLoading || assignCarrier.isPending}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select carrier…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_VALUE} className="text-xs text-muted-foreground">— Unassigned —</SelectItem>
              {carriers.data?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()} className="text-xs">
                  {c.name}
                  {c.rate_per_order && (
                    <span className="ml-1 text-muted-foreground">({money(c.rate_per_order)}/order)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
