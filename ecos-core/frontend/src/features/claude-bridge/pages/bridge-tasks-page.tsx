import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/crud';
import { ROUTES } from '@/router/routes';
import type { CbTask, TaskStatus } from '@/features/claude-bridge/types';

const STATUS_ICONS: Record<TaskStatus, string> = {
  draft:             '○',
  pending:           '○',
  queued:            '○',
  running:           '●',
  done:              '◉',
  failed:            '✗',
  approved:          '✓',
  changes_requested: '↩',
  merged:            '✓',
  cancelled:         '✗',
};

export function BridgeTasksPage() {
  const navigate = useNavigate();
  const tasks: CbTask[] = [];

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Tasks"
        subtitle="Claude Code execution queue"
        actions={
          <Button onClick={() => navigate(ROUTES.claudeBridgeTasksNew)}>
            <Plus className="mr-1 h-4 w-4" /> New Task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-3">No tasks yet.</p>
          <Button onClick={() => navigate(ROUTES.claudeBridgeTasksNew)}>
            Create first task
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <button
              key={task.id}
              className="w-full px-4 py-3 text-start hover:bg-muted/40 transition-colors"
              onClick={() => navigate(`${ROUTES.claudeBridgeTasks}/${task.id}`)}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg leading-none" aria-hidden>
                  {STATUS_ICONS[task.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{task.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {task.status_label} · {task.priority} · {task.created_at}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
