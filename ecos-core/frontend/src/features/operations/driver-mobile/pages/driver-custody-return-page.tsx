import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ROUTES } from '@/router/routes';
import { useCustodyReturns, useRecordCustodyReturn } from '../hooks/use-driver-mobile';
import { CustodyReturnList } from '../components/custody-return-list';

export function DriverCustodyReturnPage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [custodyType,  setCustodyType]  = useState('');
  const [dispatched,   setDispatched]   = useState('');
  const [returned,     setReturned]     = useState('');
  const [notes,        setNotes]        = useState('');

  const { data: custodyReturns, isLoading } = useCustodyReturns(tripId);
  const recordMutation = useRecordCustodyReturn(tripId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    recordMutation.mutate(
      {
        custody_type:   custodyType,
        dispatched_qty: parseInt(dispatched, 10),
        returned_qty:   parseInt(returned, 10),
        notes:          notes || undefined,
      },
      {
        onSuccess: () => {
          setSheetOpen(false);
          setCustodyType('');
          setDispatched('');
          setReturned('');
          setNotes('');
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(ROUTES.driverTripSettlement.replace(':tripId', tripId))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-base flex-1">Custody Returns</h1>
        <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
          <PlusCircle className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="p-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg mb-3" />
          ))
        ) : (
          <CustodyReturnList returns={custodyReturns ?? []} />
        )}
      </div>

      {/* Add custody return sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Record Custody Return</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Custody Type *</Label>
              <Input
                value={custodyType}
                onChange={(e) => setCustodyType(e.target.value)}
                placeholder="e.g. cash bag, tablet..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dispatched Qty *</Label>
              <Input
                type="number"
                min="0"
                value={dispatched}
                onChange={(e) => setDispatched(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Returned Qty *</Label>
              <Input
                type="number"
                min="0"
                value={returned}
                onChange={(e) => setReturned(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={recordMutation.isPending}>
                {recordMutation.isPending ? 'Saving...' : 'Record'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
