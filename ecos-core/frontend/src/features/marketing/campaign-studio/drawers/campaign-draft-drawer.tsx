import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Settings,
  Users,
  Image,
  Monitor,
  GitBranch,
  CheckCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import type { CampaignDraft } from '../types/campaign-studio';
import { useFormatter } from '@/hooks/use-formatter';
import { useCreateCampaignDraft, useUpdateCampaignDraft } from '../hooks/use-campaign-studio';
import { useCampaignAudience } from '../hooks/use-campaign-audience';
import { useCampaignVersions } from '../hooks/use-campaign-versions';
import { useValidateCampaign, useValidationResults } from '../hooks/use-campaign-validation';
import { useSubmitForApproval } from '../hooks/use-campaign-approval';
import { usePublishCampaign } from '../hooks/use-publishing-jobs';

type Tab = 'settings' | 'audience' | 'creatives' | 'placements' | 'versions' | 'validation' | 'approval';

const TABS: Array<{ id: Tab; label: string; icon: typeof Settings }> = [
  { id: 'settings',   label: 'Settings',    icon: Settings },
  { id: 'audience',   label: 'Audience',    icon: Users },
  { id: 'creatives',  label: 'Creatives',   icon: Image },
  { id: 'placements', label: 'Placements',  icon: Monitor },
  { id: 'versions',   label: 'History',     icon: GitBranch },
  { id: 'validation', label: 'Validation',  icon: CheckCircle },
  { id: 'approval',   label: 'Approval',    icon: Send },
];

interface Props {
  open: boolean;
  onClose: () => void;
  draft: CampaignDraft | null;
  creating?: boolean;
}

export function CampaignDraftDrawer({ open, onClose, draft, creating = false }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [newName, setNewName]     = useState('');

  const createDraft  = useCreateCampaignDraft();
  const updateDraft  = useUpdateCampaignDraft(draft?.id ?? '');
  const validate     = useValidateCampaign(draft?.id ?? '');
  const submitApproval = useSubmitForApproval(draft?.id ?? '');
  const publish      = usePublishCampaign(draft?.id ?? '');

  const { data: audience }  = useCampaignAudience(draft?.id ?? '');
  const { data: versions }  = useCampaignVersions(draft?.id ?? '');
  const { data: validation } = useValidationResults(draft?.id ?? '');

  async function handleCreate() {
    if (!newName.trim()) return;
    await createDraft.mutateAsync({ name: newName });
    onClose();
  }

  const title = creating ? 'New Campaign' : draft?.name ?? 'Campaign';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[700px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="flex-1 truncate">{title}</SheetTitle>
            {draft && (
              <Badge className="text-xs capitalize bg-gray-100 text-gray-700">{draft.internal_status.replace('_', ' ')}</Badge>
            )}
          </div>
        </SheetHeader>

        {creating ? (
          <div className="flex-1 flex flex-col justify-center px-6 py-8 gap-4">
            <p className="text-sm text-muted-foreground">Give your campaign a name to get started. You can configure all details after creation.</p>
            <Input
              placeholder="Campaign name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || createDraft.isPending}>
                {createDraft.isPending ? 'Creating…' : 'Create Campaign'}
              </Button>
            </div>
          </div>
        ) : draft ? (
          <>
            {/* Tabs */}
            <div className="flex border-b overflow-x-auto shrink-0 px-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {activeTab === 'settings' && <SettingsTab draft={draft} onUpdate={(p) => updateDraft.mutate(p)} />}
              {activeTab === 'audience' && <AudienceTab audience={audience} />}
              {activeTab === 'creatives' && <PlaceholderTab label="Creative Builder" description="Add images, videos, carousels, and story creatives." />}
              {activeTab === 'placements' && <PlaceholderTab label="Placement Builder" description="Configure placement mode (auto or manual) and select specific placements." />}
              {activeTab === 'versions'   && <VersionsTab versions={versions ?? []} />}
              {activeTab === 'validation' && <ValidationTab result={validation} onValidate={() => validate.mutate(undefined)} validating={validate.isPending} />}
              {activeTab === 'approval'   && <ApprovalTab draft={draft} onSubmit={() => submitApproval.mutate(undefined)} submitting={submitApproval.isPending} />}
            </div>

            {/* Footer actions */}
            {draft.is_editable && activeTab === 'settings' && (
              <div className="border-t px-6 py-3 flex items-center gap-2 shrink-0">
                {draft.internal_status === 'approved' && (
                  <Button size="sm" onClick={() => publish.mutate(undefined)} disabled={publish.isPending}>
                    {publish.isPending ? 'Publishing…' : 'Publish Now'}
                  </Button>
                )}
                {draft.internal_status === 'draft' && (
                  <Button size="sm" variant="outline" onClick={() => submitApproval.mutate(undefined)} disabled={submitApproval.isPending}>
                    Submit for Approval
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SettingsTab({ draft, onUpdate }: { draft: CampaignDraft; onUpdate: (p: Partial<CampaignDraft>) => void }) {
  const { money } = useFormatter();
  return (
    <div className="space-y-4">
      <Field label="Name">
        <InlineEdit value={draft.name} onSave={(v) => onUpdate({ name: v })} />
      </Field>
      <Field label="Objective">
        <span className="text-sm">{draft.objective ?? <span className="text-muted-foreground">—</span>}</span>
      </Field>
      <Field label="Budget">
        <span className="text-sm">
          {draft.budget_type === 'daily' && draft.daily_budget && `${money(parseFloat(draft.daily_budget))}/day`}
          {draft.budget_type === 'lifetime' && draft.lifetime_budget && `${money(parseFloat(draft.lifetime_budget))} lifetime`}
          {!draft.budget_type && <span className="text-muted-foreground">—</span>}
        </span>
      </Field>
      <Field label="Provider">
        <span className="text-sm capitalize">{draft.connector_type ?? <span className="text-muted-foreground">—</span>}</span>
      </Field>
      <Field label="Schedule">
        <span className="text-sm">
          {draft.start_date ? `${new Date(draft.start_date).toLocaleDateString()}` : '—'}
          {draft.end_date   ? ` → ${new Date(draft.end_date).toLocaleDateString()}` : ''}
        </span>
      </Field>
      {draft.internal_notes !== null && (
        <Field label="Internal Notes">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{draft.internal_notes ?? '—'}</p>
        </Field>
      )}
    </div>
  );
}

function AudienceTab({ audience }: { audience: Parameters<typeof useCampaignAudience>[0] extends string ? Awaited<ReturnType<typeof useCampaignAudience>>['data'] : undefined }) {
  if (!audience) return <PlaceholderTab label="Audience" description="No audience configured yet. Use the API to set targeting parameters." />;
  return (
    <div className="space-y-3">
      <Field label="Countries"><span className="text-sm">{(audience as {countries?: string[]}).countries?.join(', ') ?? '—'}</span></Field>
      <Field label="Age Range">
        <span className="text-sm">
          {((audience as {age_min?: number}).age_min != null || (audience as {age_max?: number}).age_max != null)
            ? `${(audience as {age_min?: number}).age_min ?? '13'} – ${(audience as {age_max?: number}).age_max ?? '65+'}`
            : '—'}
        </span>
      </Field>
    </div>
  );
}

function VersionsTab({ versions }: { versions: Array<{ id: string; version_number: number; change_type: string; change_note?: string | null; created_at: string }> }) {
  if (!versions.length) return <PlaceholderTab label="Version History" description="No version history yet. History is created automatically as you make changes." />;
  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="border rounded p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-muted px-1 rounded">v{v.version_number}</span>
            <span className="capitalize text-muted-foreground text-xs">{v.change_type.replace(/_/g, ' ')}</span>
            <span className="text-xs text-muted-foreground ms-auto">{new Date(v.created_at).toLocaleDateString()}</span>
          </div>
          {v.change_note && <p className="text-xs text-muted-foreground mt-1">{v.change_note}</p>}
        </div>
      ))}
    </div>
  );
}

function ValidationTab({ result, onValidate, validating }: { result: unknown; onValidate: () => void; validating: boolean }) {
  return (
    <div className="space-y-4">
      <Button size="sm" onClick={onValidate} disabled={validating}>
        <RefreshCw className={`size-3.5 mr-1.5 ${validating ? 'animate-spin' : ''}`} />
        {validating ? 'Validating…' : 'Run Validation'}
      </Button>
      {result == null ? (
        <p className="text-xs text-muted-foreground">Run validation to check for issues before publishing.</p>
      ) : (
        <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

function ApprovalTab({ draft, onSubmit, submitting }: { draft: CampaignDraft; onSubmit: () => void; submitting: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Current status: <span className="font-medium capitalize text-foreground">{draft.internal_status.replace('_', ' ')}</span>
      </p>
      {draft.submitted_for_approval_at && (
        <p className="text-xs text-muted-foreground">Submitted: {new Date(draft.submitted_for_approval_at).toLocaleString()}</p>
      )}
      {draft.internal_status === 'draft' && (
        <Button size="sm" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </Button>
      )}
    </div>
  );
}

function PlaceholderTab({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center gap-2 text-muted-foreground">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs max-w-xs">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value);
  if (!editing) {
    return (
      <button className="text-sm text-start hover:underline" onClick={() => setEditing(true)}>{value}</button>
    );
  }
  return (
    <div className="flex gap-2 items-center">
      <Input className="h-7 text-sm" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { onSave(val); setEditing(false); }}>Save</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
    </div>
  );
}
