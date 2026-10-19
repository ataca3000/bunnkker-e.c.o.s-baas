import { useState } from 'react';
import { Plus, Shield, RefreshCw, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGovernancePolicies, useCreateGovernancePolicy, useDeleteGovernancePolicy } from '../hooks/use-governance-policies';
import type { GovernancePolicy } from '../types/campaign-studio';

export function CampaignGovernancePage() {
  const [creating, setCreating]       = useState(false);
  const [editTarget, setEditTarget]   = useState<GovernancePolicy | null>(null);

  const { data, isLoading, refetch } = useGovernancePolicies();
  const deletePol                    = useDeleteGovernancePolicy();

  const policies: GovernancePolicy[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Campaign Governance</h1>
            <p className="text-xs text-muted-foreground">Naming standards, budget guardrails, publishing windows, and RBAC restrictions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4 mr-1" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Policies List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Shield className="size-10 opacity-30" />
            <p className="text-sm">No governance policies defined.</p>
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              <Plus className="size-3.5 mr-1" /> Create first policy
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={() => setEditTarget(policy)}
                onDelete={() => deletePol.mutate(policy.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inline form placeholder — full form in drawer in future */}
      {(creating || editTarget) && (
        <GovernancePolicyForm
          initial={editTarget ?? undefined}
          onClose={() => { setCreating(false); setEditTarget(null); }}
          onSaved={() => { setCreating(false); setEditTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

function PolicyCard({ policy, onEdit, onDelete }: {
  policy: GovernancePolicy;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm">{policy.name}</p>
          {policy.is_default && <Badge className="text-xs bg-blue-100 text-blue-700">Default</Badge>}
          {!policy.is_active && <Badge className="text-xs bg-gray-100 text-gray-500">Inactive</Badge>}
        </div>
        {policy.description && <p className="text-xs text-muted-foreground mb-2">{policy.description}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {policy.naming_pattern    && <span>Naming: <code className="bg-muted px-1 rounded">{policy.naming_pattern}</code></span>}
          {policy.min_daily_budget  && <span>Min daily: ${parseFloat(policy.min_daily_budget).toLocaleString()}</span>}
          {policy.max_daily_budget  && <span>Max daily: ${parseFloat(policy.max_daily_budget).toLocaleString()}</span>}
          {policy.pixel_required    && <span className="text-orange-600">Pixel required</span>}
          {policy.approval_required && <span className="text-orange-600">Approval required</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="size-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function GovernancePolicyForm({ initial, onClose, onSaved }: {
  initial?: Partial<GovernancePolicy>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useCreateGovernancePolicy();

  async function handleSave() {
    if (!initial?.name) return;
    await create.mutateAsync({ name: initial.name, description: initial.description });
    onSaved();
  }

  return (
    <div className="border-t px-6 py-4 bg-muted/20 shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm font-medium">{initial?.id ? 'Edit Policy' : 'New Policy'}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Full governance policy editor coming in the next release. For now, use the API to create detailed policies.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={create.isPending} onClick={handleSave}>
          {create.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
