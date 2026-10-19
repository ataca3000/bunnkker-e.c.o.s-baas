import React from 'react';
import type { ReleaseApproval } from '../../types/engineering';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
interface Props { approvals: ReleaseApproval[]; onDecide: (approvalId: string, decision: 'approved' | 'rejected', comment?: string) => void; onInitiate: () => void; hasApprovals: boolean; }
const STATUS_COLOR: Record<string, string> = { pending: 'bg-yellow-500', approved: 'bg-emerald-600', rejected: 'bg-red-600', expired: 'bg-gray-500', skipped: 'bg-gray-400' };
export default function ApprovalPanel({ approvals, onDecide, onInitiate, hasApprovals }: Props) {
  const [comment, setComment] = React.useState<Record<string, string>>({});
  if (!hasApprovals) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-4">No approval workflow initiated yet.</p>
        <Button size="sm" onClick={onInitiate}>Initiate Approval Workflow</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {approvals.map(a => (
        <div key={a.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium text-sm capitalize">{a.approval_level} — {a.approval_role}</p>
              <p className="text-xs text-muted-foreground">Sequence {a.sequence} · {a.is_required ? 'Required' : 'Optional'}</p>
            </div>
            <Badge className={STATUS_COLOR[a.status] + ' text-white text-xs capitalize'}>{a.status}</Badge>
          </div>
          {a.comment && <p className="text-xs text-muted-foreground italic mb-2">"{a.comment}"</p>}
          {a.status === 'pending' && (
            <div className="space-y-2">
              <textarea
                className="w-full text-xs border rounded px-2 py-1.5 resize-none"
                rows={2}
                placeholder="Comment (optional)"
                value={comment[a.id] ?? ''}
                onChange={e => setComment(prev => ({ ...prev, [a.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onDecide(a.id, 'approved', comment[a.id])}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => onDecide(a.id, 'rejected', comment[a.id])}>Reject</Button>
              </div>
            </div>
          )}
          {a.decided_at && <p className="text-xs text-muted-foreground mt-1">Decided {new Date(a.decided_at).toLocaleString()}</p>}
        </div>
      ))}
    </div>
  );
}
