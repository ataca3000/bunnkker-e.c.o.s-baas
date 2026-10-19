import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';

import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Badge } from '@/components/ui/badge';

import { DispatchBoardDrawer } from '../components/dispatch-board-drawer';
import { useDispatchBoards } from '../hooks/use-dispatch-ops';
import type { DispatchBoardSummary } from '../types/dispatch-ops';

/**
 * Dispatch boards.
 *
 * The board list already had a service; the board itself, its proposals and
 * every decision on them did not. This is the entry point to that workflow —
 * the list is a means of reaching a board, so the row opens the drawer where
 * the actual work happens.
 */
export function DispatchBoardPage() {
  const { t, i18n } = useTranslation('logistics');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: boards, isFetching, refetch } = useDispatchBoards();

  const columns: DataGridColumnDef<DispatchBoardSummary>[] = useMemo(
    () => [
      {
        key: 'board_date',
        label: t(($) => $.dispatch.board.boardDate),
        cell: (row) =>
          row.board_date ? new Date(row.board_date).toLocaleDateString(i18n.language) : '—',
      },
      {
        key: 'region',
        label: t(($) => $.dispatch.board.region),
        cell: (row) => row.dispatch_region?.name ?? '—',
      },
      {
        key: 'status',
        label: t(($) => $.dispatch.board.status),
        cell: (row) => <Badge variant="secondary">{row.status_label}</Badge>,
      },
    ],
    [t, i18n.language],
  );

  function openBoard(row: DispatchBoardSummary) {
    setSelectedId(row.id);
    setDrawerOpen(true);
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.dispatch.board.title) }]}
        title={t(($) => $.dispatch.board.title)}
        description={t(($) => $.dispatch.board.subtitle)}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              onRefresh={() => void refetch()}
              isFetching={isFetching}
              refreshLabel={t(($) => $.dispatch.board.refresh)}
            />
          </div>
        }
      >
        <div className="px-4 sm:px-6">
          <UniversalDataGrid<DispatchBoardSummary>
            data={boards ?? []}
            columns={columns}
            rowId={(row) => row.id}
            loading={isFetching && (boards ?? []).length === 0}
            onRowClick={openBoard}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.dispatch.board.empty)}
                </p>
              </div>
            }
          />
        </div>
      </WorkspacePage>

      <DispatchBoardDrawer
        key={`${selectedId ?? 'none'}-${String(drawerOpen)}`}
        boardId={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}

export default DispatchBoardPage;
