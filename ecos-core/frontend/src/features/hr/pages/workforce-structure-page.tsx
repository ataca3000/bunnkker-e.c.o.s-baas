import { useState } from 'react';
import { Plus } from 'lucide-react';

import { EntityDrawer, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateDepartment,
  useCreateJobGrade,
  useCreatePosition,
  useDepartmentTreeQuery,
  useDepartmentsQuery,
  useEmploymentTypesQuery,
  useJobGradesQuery,
  usePositionsQuery,
} from '@/features/hr/hooks/use-hr';
import type { DepartmentNode } from '@/features/hr/types/hr';

/** A department and everything nested beneath it. */
function DepartmentBranch({ node, depth }: { node: DepartmentNode; depth: number }) {
  return (
    <li>
      <div
        className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium">{node.name}</span>
          <span className="text-muted-foreground font-mono text-xs">{node.code}</span>
        </div>
        <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {node.employees_count}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <DepartmentBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Departments, positions, job grades and employment types — the structure an
 * employee is placed into. Companies and branches are owned by the Organization
 * module and referenced from here rather than redefined.
 */
export function WorkforceStructurePage() {
  const [drawer, setDrawer] = useState<'department' | 'position' | 'grade' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [department, setDepartment] = useState({ code: '', name: '', parent_id: '' });
  const [position, setPosition] = useState({ code: '', title: '', department_id: '', headcount_limit: '' });
  const [grade, setGrade] = useState({ code: '', name: '', level: '1' });

  const { data: tree } = useDepartmentTreeQuery();
  const { data: departments } = useDepartmentsQuery();
  const { data: positions } = usePositionsQuery();
  const { data: grades } = useJobGradesQuery();
  const { data: types } = useEmploymentTypesQuery();

  const createDepartment = useCreateDepartment();
  const createPosition = useCreatePosition();
  const createGrade = useCreateJobGrade();

  const close = () => {
    setDrawer(null);
    setError(null);
  };

  const save = async () => {
    setError(null);

    try {
      if (drawer === 'department') {
        await createDepartment.mutateAsync({
          code: department.code,
          name: department.name,
          parent_id: department.parent_id || undefined,
        });
        setDepartment({ code: '', name: '', parent_id: '' });
      }

      if (drawer === 'position') {
        await createPosition.mutateAsync({
          code: position.code,
          title: position.title,
          department_id: position.department_id || undefined,
          headcount_limit: position.headcount_limit ? Number(position.headcount_limit) : undefined,
        });
        setPosition({ code: '', title: '', department_id: '', headcount_limit: '' });
      }

      if (drawer === 'grade') {
        await createGrade.mutateAsync({ code: grade.code, name: grade.name, level: Number(grade.level) || 1 });
        setGrade({ code: '', name: '', level: '1' });
      }

      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be saved.');
    }
  };

  const saving = createDepartment.isPending || createPosition.isPending || createGrade.isPending;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workforce Structure"
        subtitle="Departments, positions, job grades and employment types. Companies and branches are owned by Organization."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Departments</h2>
              <Button size="sm" variant="outline" onClick={() => setDrawer('department')}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {(tree ?? []).length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No departments yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(tree ?? []).map((node) => (
                  <DepartmentBranch key={node.id} node={node} depth={0} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Positions</h2>
              <Button size="sm" variant="outline" onClick={() => setDrawer('position')}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {(positions ?? []).length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No positions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Title</th>
                      <th className="py-2 pr-4 font-medium">Department</th>
                      <th className="py-2 pr-4 text-right font-medium">Filled</th>
                      <th className="py-2 pr-4 text-right font-medium">Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(positions ?? []).map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{p.title}</td>
                        <td className="text-muted-foreground py-2 pr-4">{p.department?.name ?? '—'}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{p.filled_headcount}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {p.headcount_limit ?? '∞'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Job Grades</h2>
              <Button size="sm" variant="outline" onClick={() => setDrawer('grade')}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {(grades ?? []).length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No job grades yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(grades ?? []).map((g) => (
                  <li key={g.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="text-muted-foreground text-xs">Level {g.level}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* Pay bands live in Payroll — a grade here carries a level only. */}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Employment Types</h2>
            {(types ?? []).length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No employment types yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(types ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{t.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <EntityDrawer
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          drawer === 'department' ? 'New Department' : drawer === 'position' ? 'New Position' : 'New Job Grade'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {drawer === 'department' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dep_code">Code</Label>
                <Input
                  id="dep_code"
                  value={department.code}
                  onChange={(e) => setDepartment({ ...department, code: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dep_name">Name</Label>
                <Input
                  id="dep_name"
                  value={department.name}
                  onChange={(e) => setDepartment({ ...department, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dep_parent">Parent Department</Label>
                <select
                  id="dep_parent"
                  value={department.parent_id}
                  onChange={(e) => setDepartment({ ...department, parent_id: e.target.value })}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Top level</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {drawer === 'position' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pos_code">Code</Label>
                <Input
                  id="pos_code"
                  value={position.code}
                  onChange={(e) => setPosition({ ...position, code: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pos_title">Title</Label>
                <Input
                  id="pos_title"
                  value={position.title}
                  onChange={(e) => setPosition({ ...position, title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pos_department">Department</Label>
                <select
                  id="pos_department"
                  value={position.department_id}
                  onChange={(e) => setPosition({ ...position, department_id: e.target.value })}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Not assigned</option>
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pos_limit">Headcount Limit</Label>
                <Input
                  id="pos_limit"
                  type="number"
                  min={1}
                  value={position.headcount_limit}
                  onChange={(e) => setPosition({ ...position, headcount_limit: e.target.value })}
                  placeholder="Leave blank for unlimited"
                />
              </div>
            </>
          ) : null}

          {drawer === 'grade' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grade_code">Code</Label>
                <Input
                  id="grade_code"
                  value={grade.code}
                  onChange={(e) => setGrade({ ...grade, code: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grade_name">Name</Label>
                <Input
                  id="grade_name"
                  value={grade.name}
                  onChange={(e) => setGrade({ ...grade, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grade_level">Level</Label>
                <Input
                  id="grade_level"
                  type="number"
                  min={1}
                  value={grade.level}
                  onChange={(e) => setGrade({ ...grade, level: e.target.value })}
                />
                <span className="text-muted-foreground text-xs">
                  Ordering only — pay bands belong to Payroll.
                </span>
              </div>
            </>
          ) : null}
        </div>
      </EntityDrawer>
    </div>
  );
}
