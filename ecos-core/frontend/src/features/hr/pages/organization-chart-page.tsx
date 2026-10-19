import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganizationChartQuery } from '@/features/hr/hooks/use-hr';
import type { OrgChartNode } from '@/features/hr/types/hr';

/** One person and everyone beneath them, rendered recursively. */
function ChartNode({ node, depth }: { node: OrgChartNode; depth: number }) {
  const { t } = useTranslation('hr');

  return (
    <li className="relative">
      <div
        className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
        style={{ marginInlineStart: depth * 20 }}
      >
        <div className="flex flex-col">
          <Link to={`/hr/employees/${node.id}`} className="text-sm font-medium hover:underline">
            {node.name}
          </Link>
          <span className="text-muted-foreground text-xs">
            {node.position ?? t($ => $.orgChart.noPosition)}
            {node.department ? ` · ${node.department}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-xs">{node.employee_number}</span>
          {node.direct_reports > 0 ? (
            <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
              {node.direct_reports}
            </span>
          ) : null}
        </div>
      </div>

      {node.children.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <ChartNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Organization Chart — built from the current primary reporting lines.
 *
 * Anyone without a standing manager appears as a root, so an unassigned employee
 * is visible rather than silently missing from the picture.
 */
export function OrganizationChartPage() {
  const { t } = useTranslation('hr');
  const { data, isLoading, isError, refetch } = useOrganizationChartQuery();

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.orgChart.title)}
        subtitle={t($ => $.orgChart.subtitle)}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.orgChart.stats.employees)}</div>
            <div className="text-2xl font-bold">{data.employees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.orgChart.stats.topLevel)}</div>
            <div className="text-2xl font-bold">{data.roots.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.orgChart.stats.outsideChart)}</div>
            <div className="text-2xl font-bold text-amber-600">{data.unassigned}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {data.roots.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t($ => $.orgChart.empty)}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.roots.map((root) => (
                <ChartNode key={root.id} node={root} depth={0} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
