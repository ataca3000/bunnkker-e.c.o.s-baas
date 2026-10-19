import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { useMacros, useDeleteMacro } from '../hooks/use-macros';
import type { MacroCategory } from '../types/conversation';

const CATEGORY_LABELS: Record<MacroCategory, string> = {
  welcome: 'Welcome',
  order_confirmation: 'Order Confirmation',
  shipping_update: 'Shipping Update',
  payment_reminder: 'Payment Reminder',
  refund: 'Refund',
  complaint: 'Complaint',
  support: 'Support',
  custom: 'Custom',
};

export function MacrosPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (category !== 'all') params.category = category;

  const { data, isLoading } = useMacros(params);
  const macros = data?.data ?? [];
  const deleteMacro = useDeleteMacro();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Conversation Macros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-written responses agents can apply with one click
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Macro
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search macros..."
          className="max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as MacroCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : macros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Zap className="w-10 h-10" />
          <p className="font-medium">No macros yet</p>
          <p className="text-sm">Create macros to speed up responses</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {macros.map((macro) => (
            <div key={macro.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{macro.name}</span>
                  {macro.shortcut && (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{macro.shortcut}</code>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[macro.category]}
                  </Badge>
                  {macro.is_shared && (
                    <Badge variant="outline" className="text-xs">
                      Shared
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{macro.content}</p>
                <p className="text-xs text-muted-foreground mt-1">Used {macro.usage_count} times</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive flex-shrink-0"
                onClick={() => deleteMacro.mutate(macro.id)}
                disabled={deleteMacro.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
