import { useState } from 'react';
import { useLeads, useQualifyLead, useDisqualifyLead } from '../hooks/use-cep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  LEAD_STATUS_LABELS, PRIORITY_LABELS,
  type LeadStatus, type ConversationPriority,
} from '../types/cep';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new:         'bg-blue-100 text-blue-800',
  contacted:   'bg-sky-100 text-sky-800',
  qualified:   'bg-green-100 text-green-800',
  unqualified: 'bg-gray-100 text-gray-600',
  converted:   'bg-emerald-100 text-emerald-800',
  lost:        'bg-red-100 text-red-700',
};

export function CepLeadsPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useLeads({
    status:   status || undefined,
    search:   search || undefined,
    per_page: 25,
    page,
  });

  const qualifyMutation    = useQualifyLead();
  const disqualifyMutation = useDisqualifyLead();

  const leads = data?.data ?? [];
  const meta  = data?.meta;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lead Engine</h1>
        <p className="text-sm text-muted-foreground">{meta?.total ?? 0} leads · Created from conversations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search leads…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="text-start px-3 py-2 font-medium">Customer</th>
              <th className="text-start px-3 py-2 font-medium">Status</th>
              <th className="text-start px-3 py-2 font-medium">Priority</th>
              <th className="text-start px-3 py-2 font-medium">Score</th>
              <th className="text-start px-3 py-2 font-medium">Source</th>
              <th className="text-start px-3 py-2 font-medium">Created</th>
              <th className="text-end px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-3 py-2"><div className="h-4 bg-muted rounded" /></td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                  No leads yet. Create leads from conversations in the Unified Inbox.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium">{lead.customer_name}</p>
                    {lead.customer_phone && <p className="text-xs text-muted-foreground">{lead.customer_phone}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className={`text-xs ${LEAD_STATUS_COLORS[lead.status]}`}>
                      {lead.status_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{PRIORITY_LABELS[lead.priority as ConversationPriority] ?? lead.priority}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{lead.score ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{lead.source ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="flex gap-1 justify-end">
                      {lead.status === 'new' || lead.status === 'contacted' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => qualifyMutation.mutate({ leadId: lead.id })}
                            disabled={qualifyMutation.isPending}
                          >
                            Qualify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => disqualifyMutation.mutate({ leadId: lead.id, reason: 'Manually disqualified' })}
                            disabled={disqualifyMutation.isPending}
                          >
                            Disqualify
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{lead.status_label}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {meta.current_page} of {meta.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
