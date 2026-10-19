import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ActionMenu, ConfirmDialog, PageHeader, StatusBadge } from '@/components/crud';
import { useToast } from '@/components/ds/use-toast';
import { CoverageAreaDialog } from '@/features/branches/components/coverage-area-dialog';
import { useBranchesQuery } from '@/features/branches/hooks/use-branches';
import {
  useAddCoverageArea,
  useBranchCoverageQuery,
  useDeleteCoverageArea,
  useUpdateCoverageArea,
} from '@/features/branches/hooks/use-branch-coverage';
import type { Branch, CoverageArea, CoverageAreaPayload } from '@/features/branches/types/branch';
import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import { ROUTES } from '@/router/routes';

type WarehouseOption = { id: string; code: string; name: string };

async function fetchWarehouses(): Promise<WarehouseOption[]> {
  const { data } = await api.get<ApiResponse<{ items: WarehouseOption[] }>>('/warehouses', {
    params: { per_page: 100 },
  });
  return data.data.items;
}

export function BranchCoveragePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CoverageArea | null>(null);
  const [deletingArea, setDeletingArea] = useState<CoverageArea | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [prevBranchId, setPrevBranchId] = useState<string | null>(null);

  const { data: branchesData, isLoading: loadingBranches } = useBranchesQuery({
    per_page: 100,
    sort_by: 'name',
    sort_dir: 'asc',
  });
  // Memoised so the empty-state fallback keeps a stable identity between renders.
  const branches = useMemo(() => branchesData?.items ?? [], [branchesData]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  if (selectedBranchId !== prevBranchId) {
    setPrevBranchId(selectedBranchId);
    setWarehouseId(selectedBranch?.default_warehouse_id ?? '');
  }

  const { data: coverageAreas = [], isLoading: loadingCoverage } = useBranchCoverageQuery(
    selectedBranchId,
  );

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: fetchWarehouses,
    staleTime: 5 * 60 * 1000,
  });

  const addArea = useAddCoverageArea(selectedBranchId ?? '');
  const updateArea = useUpdateCoverageArea(selectedBranchId ?? '');
  const deleteArea = useDeleteCoverageArea(selectedBranchId ?? '');

  const updateWarehouse = useMutation({
    mutationFn: async (wId: string | null) => {
      const branch = selectedBranch!;
      const { data } = await api.put<ApiResponse<Branch>>(
        `/branches/${branch.id}`,
        {
          company_id:           branch.company_id,
          code:                 branch.code,
          name:                 branch.name,
          phone:                branch.phone ?? undefined,
          email:                branch.email ?? undefined,
          manager_name:         branch.manager_name ?? undefined,
          address:              branch.address ?? undefined,
          city:                 branch.city ?? undefined,
          country:              branch.country ?? undefined,
          is_head_office:       branch.is_head_office,
          is_active:            branch.is_active,
          latitude:             branch.latitude ?? undefined,
          longitude:            branch.longitude ?? undefined,
          default_warehouse_id: wId || null,
        },
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({ title: 'Default warehouse updated.' });
    },
    onError: () => {
      toast({ title: 'Failed to save warehouse.', variant: 'destructive' });
    },
  });

  const handleSaveArea = (payload: CoverageAreaPayload) => {
    if (editingArea) {
      updateArea.mutate(
        { areaId: editingArea.id, payload },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditingArea(null);
            toast({ title: 'Coverage area updated.' });
          },
        },
      );
    } else {
      addArea.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false);
          toast({ title: 'Coverage area added.' });
        },
      });
    }
  };

  const handleDeleteArea = () => {
    if (!deletingArea) return;
    deleteArea.mutate(deletingArea.id, {
      onSuccess: () => {
        setDeletingArea(null);
        toast({ title: 'Coverage area removed.' });
      },
    });
  };

  const openAdd = () => {
    setEditingArea(null);
    setDialogOpen(true);
  };

  const openEdit = (area: CoverageArea) => {
    setEditingArea(area);
    setDialogOpen(true);
  };

  const coveragePreview = useMemo(() => {
    const labels = coverageAreas
      .filter((a) => a.is_active)
      .map((a) => {
        const govName = a.governorate?.name ?? '';
        const zoneName = a.zone?.name ?? '';
        return zoneName ? `${govName} › ${zoneName}` : govName;
      })
      .filter(Boolean);

    if (labels.length === 0) return null;
    return labels.join(', ');
  }, [coverageAreas]);

  const activationBlocked =
    selectedBranch?.is_active === true && !selectedBranch.default_warehouse_id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branch Coverage"
        subtitle="Manage which areas each branch serves and assign default warehouses."
        breadcrumbs={[
          { label: 'Home', to: ROUTES.dashboard },
          { label: 'Administration', to: ROUTES.organization },
          { label: 'Branch Coverage' },
        ]}
      />

      <div className="grid grid-cols-[280px_1fr] gap-6 items-start">
        {/* Left panel — branch list */}
        <Card className="sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Branches
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingBranches ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
            ) : branches.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No branches found.</div>
            ) : (
              <ul className="divide-y">
                {branches.map((branch) => (
                  <li key={branch.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBranchId(branch.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        branch.id === selectedBranchId ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{branch.name}</span>
                        <StatusBadge status={branch.is_active ? 'active' : 'inactive'} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{branch.code}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right panel — coverage detail */}
        {!selectedBranch ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <Building2 className="size-10 opacity-30" />
              <p className="text-sm">Select a branch to manage its coverage areas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Branch header */}
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{selectedBranch.name}</h2>
                    {selectedBranch.is_head_office && (
                      <Badge variant="secondary">Head Office</Badge>
                    )}
                    <StatusBadge status={selectedBranch.is_active ? 'active' : 'inactive'} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedBranch.code}
                    {selectedBranch.city ? ` · ${selectedBranch.city}` : ''}
                    {selectedBranch.company ? ` · ${selectedBranch.company.name}` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activation warning */}
            {activationBlocked && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Warehouse Required</AlertTitle>
                <AlertDescription>
                  This branch is active but has no default warehouse assigned. Assign one below to
                  ensure orders can be fulfilled.
                </AlertDescription>
              </Alert>
            )}

            {/* Default Warehouse */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Warehouse className="size-4" />
                  Default Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="warehouse-select">Assigned Warehouse</Label>
                  <select
                    id="warehouse-select"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none"
                  >
                    <option value="">— None —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => updateWarehouse.mutate(warehouseId || null)}
                  disabled={
                    updateWarehouse.isPending ||
                    warehouseId === (selectedBranch.default_warehouse_id ?? '')
                  }
                >
                  {updateWarehouse.isPending ? 'Saving…' : 'Save'}
                </Button>
              </CardContent>
            </Card>

            {/* Coverage Areas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4" />
                  Coverage Areas
                </CardTitle>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-4" />
                  Add Area
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingCoverage ? (
                  <div className="px-6 py-4 text-sm text-muted-foreground">Loading…</div>
                ) : coverageAreas.length === 0 ? (
                  <div className="px-6 py-4 text-sm text-muted-foreground">
                    No coverage areas defined. Add at least one governorate to activate this branch.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2">Governorate</th>
                        <th className="px-4 py-2">Zone</th>
                        <th className="px-4 py-2">Priority</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {coverageAreas.map((area) => (
                        <tr key={area.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">
                            {area.governorate?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {area.zone?.name ?? (
                              <span className="italic">Entire governorate</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{area.priority}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={area.is_active ? 'active' : 'inactive'} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <ActionMenu
                              label={`Actions for ${area.governorate?.name}`}
                              items={[
                                {
                                  key: 'edit',
                                  label: 'Edit',
                                  icon: Pencil,
                                  onSelect: () => openEdit(area),
                                },
                                {
                                  key: 'delete',
                                  label: 'Remove',
                                  icon: Trash2,
                                  variant: 'destructive',
                                  onSelect: () => setDeletingArea(area),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Coverage preview */}
            {coveragePreview && (
              <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                <CardContent className="flex items-start gap-3 pt-5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      This branch serves
                    </p>
                    <p className="mt-0.5 text-sm text-green-700 dark:text-green-300">
                      {coveragePreview}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <CoverageAreaDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingArea(null);
        }}
        area={editingArea}
        onSave={handleSaveArea}
        isPending={addArea.isPending || updateArea.isPending}
      />

      <ConfirmDialog
        open={deletingArea !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingArea(null);
        }}
        title="Remove Coverage Area"
        description={`Remove ${deletingArea?.governorate?.name ?? 'this area'}${deletingArea?.zone ? ` › ${deletingArea.zone.name}` : ''} from this branch's coverage?`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleteArea.isPending}
        onConfirm={handleDeleteArea}
      />
    </div>
  );
}
