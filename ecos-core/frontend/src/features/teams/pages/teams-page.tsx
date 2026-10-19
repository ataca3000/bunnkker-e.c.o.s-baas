import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompanySelect } from '@/features/branches/components/company-select';
import { TeamDetailDrawer } from '@/features/teams/components/team-detail-drawer';
import { TeamFormDrawer } from '@/features/teams/components/team-form-drawer';
import { useTeamsQuery, useDeleteTeam } from '@/features/teams/hooks/use-teams';
import type { Team } from '@/features/teams/types/team';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 15;

const OPTIONAL_COLS = [
  { key: 'code',        label: 'Code' },
  { key: 'company',     label: 'Company' },
  { key: 'leader_name', label: 'Leader' },
] as const;

export function TeamsPage() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const params = useMemo(
    () => ({
      search: search || undefined,
      company_id: companyFilter || undefined,
      status: statusFilter || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [search, companyFilter, statusFilter, page],
  );

  const { data, isLoading, isError, isFetching, refetch } = useTeamsQuery(params);
  const deleteTeam = useDeleteTeam();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const totalCount = meta?.total ?? 0;
  const activeCount = items.filter((t) => t.is_active).length;
  const inactiveCount = items.filter((t) => !t.is_active).length;

  function toggleCol(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openCreate = () => {
    setActiveTeam(null);
    setFormDrawerOpen(true);
  };

  const openEdit = (team: Team) => {
    setActiveTeam(team);
    setFormDrawerOpen(true);
  };

  const openDetail = (team: Team) => {
    setActiveTeam(team);
    setDetailDrawerOpen(true);
  };

  const columns: ColumnDef<Team>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (t) => <span className="font-mono text-xs font-medium">{t.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (t) => <span className="font-medium">{t.name}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      cell: (t) => <span className="text-muted-foreground">{t.company?.name ?? '—'}</span>,
    },
    {
      key: 'leader_name',
      header: 'Leader',
      cell: (t) => (
        <span className="text-muted-foreground">{t.leader_name ?? '—'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (t) => <StatusBadge status={t.is_active ? 'active' : 'inactive'} />,
    },
  ];

  const confirmDelete = () => {
    if (!deleting) return;
    deleteTeam.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        subtitle="Manage your organization's teams and assign leaders."
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Organization', to: ROUTES.organization },
          { label: 'Teams' },
        ]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New Team
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Total Teams</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Active Teams</div>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? '—' : activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Inactive Teams</div>
            <div className="text-2xl font-bold text-slate-400">
              {isLoading ? '—' : inactiveCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder="Search teams…"
            onSearchChange={handleSearch}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => {
              setCompanyFilter(null);
              setStatusFilter('');
              setPage(1);
            }}
            filterPanel={
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Company</span>
                  <CompanySelect
                    value={companyFilter}
                    onChange={(value) => {
                      setCompanyFilter(value);
                      setPage(1);
                    }}
                    placeholder="All Companies"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </>
            }
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Show/Hide Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPTIONAL_COLS.map(({ key, label }) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={!hiddenCols.has(key)}
                    onCheckedChange={() => toggleCol(key)}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </EntityToolbar>

          <EntityTable<Team>
            columns={columns.filter((c) => !hiddenCols.has(c.key))}
            data={items}
            getRowId={(t) => t.id}
            isLoading={isLoading}
            isError={isError}
            rowActions={(team) => (
              <ActionMenu
                label={`Actions for ${team.name}`}
                items={[
                  { key: 'view', label: 'View', icon: Eye, onSelect: () => openDetail(team) },
                  { key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => openEdit(team) },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'destructive',
                    onSelect: () => setDeleting(team),
                  },
                ]}
              />
            )}
          />

          {meta ? (
            <Pagination
              meta={{
                page: meta.current_page,
                perPage: meta.per_page,
                total: meta.total,
                lastPage: meta.last_page,
              }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <TeamFormDrawer
        open={formDrawerOpen}
        onOpenChange={(open) => {
          setFormDrawerOpen(open);
          if (!open) setActiveTeam(null);
        }}
        team={activeTeam}
      />

      <TeamDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={(open) => {
          setDetailDrawerOpen(open);
          if (!open) setActiveTeam(null);
        }}
        team={activeTeam}
        onEdit={openEdit}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleting?.name ?? ''}"? This action can be undone.`}
        confirmLabel="Delete Team"
        variant="destructive"
        loading={deleteTeam.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
