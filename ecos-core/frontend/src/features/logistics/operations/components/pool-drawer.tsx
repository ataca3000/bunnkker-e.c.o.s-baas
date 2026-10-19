import { useState } from 'react';
import { AlertTriangle, Unlink } from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { usePoolHealth, useSetMemberStatus, useUnifiedPool } from '../hooks/use-operations';
import type { UnifiedMember } from '../types/operations';
import { AuthorityBadge, MemberStatusBadge } from './operations-badges';

function MemberRow({ member }: { member: UnifiedMember }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);
  const setStatus = useSetMemberStatus();

  const blockers = member.fitness?.blockers ?? [];
  const warnings = member.fitness?.warnings ?? [];

  return (
    <div className="rounded-md border p-2.5">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              {member.label ?? `${member.member_type} #${member.member_id}`}
            </span>
            <MemberStatusBadge status={member.membership_status} />
            {/* Who decides readiness — never this module. */}
            <AuthorityBadge authority={member.readiness_authority} />
            {member.is_orphaned && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <Unlink className="size-2.5" />
                No longer exists
              </Badge>
            )}
          </div>

          {/* The owning module's ordered reasons, quoted. */}
          {blockers.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-1 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {blocker}
                </li>
              ))}
            </ul>
          )}
          {blockers.length === 0 && warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {warnings.map((warning) => (
                <li key={warning} className="text-xs text-amber-600">
                  {warning}
                </li>
              ))}
            </ul>
          )}
          {member.membership_reason && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{member.membership_reason}</p>
          )}
        </div>

        <span
          className={`shrink-0 text-xs ${member.is_available ? 'text-emerald-600' : 'text-muted-foreground'}`}
        >
          {member.is_available ? 'Available' : 'Not available'}
        </span>
      </button>

      {expanded && member.membership_status !== 'withdrawn' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="h-8 max-w-xs text-xs"
          />
          {member.membership_status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate(
                  {
                    memberId: member.membership_id,
                    status: 'suspended',
                    reason: reason.trim() || undefined,
                  },
                  {
                    onSuccess: () => toast({ title: 'Held out of the pool.' }),
                    onError: () =>
                      toast({ title: 'That could not be changed.', variant: 'destructive' }),
                  },
                )
              }
            >
              Hold out
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate(
                  {
                    memberId: member.membership_id,
                    status: 'active',
                    reason: reason.trim() || undefined,
                  },
                  {
                    onSuccess: () => toast({ title: 'Back in the pool.' }),
                    onError: () =>
                      toast({ title: 'That could not be changed.', variant: 'destructive' }),
                  },
                )
              }
            >
              Put back
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive"
            // Without a reason nobody can tell later whether it was sold or lent.
            disabled={reason.trim().length === 0 || setStatus.isPending}
            onClick={() =>
              setStatus.mutate(
                {
                  memberId: member.membership_id,
                  status: 'withdrawn',
                  reason: reason.trim(),
                },
                {
                  onSuccess: () => toast({ title: 'Removed from the pool.' }),
                  onError: () =>
                    toast({ title: 'That could not be removed.', variant: 'destructive' }),
                },
              )
            }
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * One pool: what it holds, and what each member's owning module says about it.
 *
 * Membership status and readiness are shown side by side but never merged. "Held
 * out" means this pool is not drawing on the vehicle; it says nothing about
 * whether the vehicle is roadworthy, and conflating the two would read as a
 * safety verdict Operations is not entitled to give.
 */
export function PoolDrawer({
  poolId,
  open,
  onOpenChange,
}: {
  poolId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: unified, isLoading } = useUnifiedPool(poolId);
  const { data: health } = usePoolHealth(poolId);

  if (poolId === null) return null;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={health?.pool_name ?? 'Pool'}
      description="Membership joined to Fleet's and Drivers' current verdicts"
      size="2xl"
    >
      {isLoading || !unified ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-5">
          {health && !health.is_healthy && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-xs">
                <ul className="space-y-0.5">
                  {health.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-4 gap-3 text-sm">
            {[
              { label: 'Members', value: unified.counts.members },
              { label: 'Available', value: unified.counts.available },
              { label: 'Held out', value: unified.counts.suspended },
              { label: 'Can field', value: health?.fieldable_units ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-md border p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-lg tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {unified.members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              The pool has no members, so it can field nothing.
            </p>
          ) : (
            <div className="space-y-2">
              {unified.members.map((member) => (
                <MemberRow key={member.membership_id} member={member} />
              ))}
            </div>
          )}
        </div>
      )}
    </PageDrawer>
  );
}
