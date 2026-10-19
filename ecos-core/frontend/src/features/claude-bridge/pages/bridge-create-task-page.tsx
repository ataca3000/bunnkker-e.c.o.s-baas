import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/router/routes';

export function BridgeCreateTaskPage() {
  const navigate = useNavigate();

  const [title, setTitle]               = useState('');
  const [description, setDescription]  = useState('');
  const [repoPath, setRepoPath]         = useState(
    () => localStorage.getItem('cb_last_repo_path') ?? '',
  );
  const [branch, setBranch]             = useState('main');
  const [priority, setPriority]         = useState('normal');

  function handleSaveDraft() {
    // Sprint 2: POST /api/cb/tasks with status pending
    navigate(ROUTES.claudeBridgeTasks);
  }

  function handleQueue() {
    // Sprint 2: POST /api/cb/tasks then POST /api/cb/tasks/{id}/queue
    if (repoPath) localStorage.setItem('cb_last_repo_path', repoPath);
    navigate(ROUTES.claudeBridgeTasks);
  }

  return (
    <div className="space-y-4 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.claudeBridgeTasks)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Tasks
        </Button>
        <h1 className="text-lg font-semibold">New Task</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Add CSV export to Orders endpoint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what Claude should implement. Be specific — this becomes the task prompt."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repo">Repository Path</Label>
            <Input
              id="repo"
              placeholder="C:\Projects\ecos-erp"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Local path on the worker machine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="branch">Target Branch</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleSaveDraft} disabled={!title}>
          Save Draft
        </Button>
        <Button onClick={handleQueue} disabled={!title || !description || !repoPath}>
          Queue ▶
        </Button>
      </div>
    </div>
  );
}
