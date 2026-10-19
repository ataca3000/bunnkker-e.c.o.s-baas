import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAddCustodyItem, useRemoveCustodyItem } from '../hooks/use-distribution-board';
import { CUSTODY_ITEM_LABELS, type CustodyItem, type CustodyItemType } from '../types/distribution-board';

interface CustodyPanelProps {
  tripId: string;
  items: CustodyItem[];
}

const ITEM_TYPES = Object.entries(CUSTODY_ITEM_LABELS) as [CustodyItemType, string][];

export function CustodyPanel({ tripId, items }: CustodyPanelProps) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<CustodyItemType>('delivery_bags');
  const [qty, setQty] = useState('1');
  const addItem     = useAddCustodyItem();
  const removeItem  = useRemoveCustodyItem();

  function handleAdd() {
    addItem.mutate(
      { tripId, payload: { item_type: type, quantity: Number(qty) || 1 } },
      { onSuccess: () => { setAdding(false); setQty('1'); } },
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custody</span>
        {!adding && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Existing items */}
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-0.5 group">
          <span className="text-xs text-muted-foreground">
            {item.label} {item.quantity > 1 && <span className="font-mono">×{item.quantity}</span>}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => removeItem.mutate({ tripId, custodyId: item.id })}
            disabled={removeItem.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <div className="flex items-center gap-1.5 mt-1">
          <Select value={type} onValueChange={(v) => setType(v as CustodyItemType)}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_TYPES.map(([val, label]) => (
                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="1"
            className="h-7 w-14 text-xs"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleAdd} disabled={addItem.isPending}>
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground/50 italic">No custody items</p>
      )}
    </div>
  );
}
