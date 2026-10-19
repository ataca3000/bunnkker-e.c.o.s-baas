import { History, Lock, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Team } from '@/features/teams/types/team';

type TeamDetailDrawerProps = {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (team: Team) => void;
};

function OverviewTab({ team }: { team: Team }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Leader highlight */}
      {team.leader_name && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
          <Users className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Team Leader</p>
            <p className="text-sm font-medium">{team.leader_name}</p>
          </div>
        </div>
      )}

      {/* Team stats mini-grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-muted/30 p-2.5 text-center">
          <p className="text-lg font-bold text-slate-400">0</p>
          <p className="text-[10px] text-muted-foreground">Members</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2.5 text-center">
          <Badge variant={team.is_active ? 'default' : 'secondary'} className="mt-1">
            {team.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">Status</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 text-center -mt-2">
        Member metrics will be available in a future update.
      </p>

      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono font-medium">{team.code}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{team.name}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Company</dt>
          <dd>{team.company?.name ?? '—'}</dd>
        </div>
        {!team.leader_name && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Leader</dt>
              <dd className="text-muted-foreground">—</dd>
            </div>
          </>
        )}
        {team.description && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-sm">{team.description}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-muted-foreground text-xs">
            {team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function MembersTab() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Team Members</p>
          <p className="text-xs text-muted-foreground">People assigned to this team</p>
        </div>
        <Badge variant="outline" className="text-xs">0 members</Badge>
      </div>
      <Separator />
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center rounded-md border border-dashed">
        <Users className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No members assigned</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Team member management will be available in a future update.
        </p>
      </div>
    </div>
  );
}

function PermissionsTab() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Permissions</p>
          <p className="text-xs text-muted-foreground">Access control rules for this team</p>
        </div>
        <Badge variant="outline" className="text-xs">Not configured</Badge>
      </div>
      <Separator />
      {['View Orders', 'Manage Inventory', 'Process Payments', 'Admin Access'].map((perm) => (
        <div key={perm} className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{perm}</span>
          </div>
          <Badge variant="secondary" className="text-xs">Not set</Badge>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
        Permission configuration will be available in a future update.
      </p>
    </div>
  );
}

export function TeamDetailDrawer({ team, open, onOpenChange }: TeamDetailDrawerProps) {
  if (!team) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Users className="text-primary size-5" />
            </div>
            <div>
              <SheetTitle>{team.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs">{team.code}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              Members
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex-1">
              Permissions
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab team={team} />
          </TabsContent>

          <TabsContent value="members">
            <MembersTab />
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>

          <TabsContent value="activity">
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <History className="text-muted-foreground/40 size-12" />
              <p className="text-muted-foreground font-medium">Activity timeline coming soon</p>
              <p className="text-muted-foreground/70 max-w-xs text-xs">
                A full audit trail for this team will be available in a future update.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
