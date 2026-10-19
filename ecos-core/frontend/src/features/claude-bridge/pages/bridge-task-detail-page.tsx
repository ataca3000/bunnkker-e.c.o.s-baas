import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/router/routes';

type Tab = 'summary' | 'log' | 'diff' | 'report';

export function BridgeTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [reviewComment, setReviewComment] = useState('');

  // Placeholder state — Sprint 2 wires real data
  const task = null;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.claudeBridgeTasks)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Tasks
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1">
          {task ? 'Task title' : 'Loading…'}
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Task ID: {id}</p>
              <p className="text-muted-foreground text-sm mt-4">
                Sprint 2 will load real task data here.
              </p>
            </CardContent>
          </Card>

          {/* Review actions placeholder — shown when status is "done" */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Review Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Review comment (required for Request Changes)…"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button className="flex-1" disabled>Approve</Button>
                <Button className="flex-1" variant="outline" disabled>Request Changes</Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Available when task status is "Awaiting Review".
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="rounded bg-muted p-4 font-mono text-xs min-h-48">
                <p className="text-muted-foreground">No log lines yet.</p>
              </div>
              <Button size="sm" variant="outline" className="mt-3" disabled>
                Load More
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diff" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded bg-muted p-4 font-mono text-xs min-h-48">
                <p className="text-muted-foreground">No diff available yet.</p>
              </div>
              <Button size="sm" variant="outline" className="mt-3" disabled>
                Download Diff
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardContent className="pt-4 min-h-48">
              <p className="text-muted-foreground text-sm">No report available yet.</p>
              <Button size="sm" variant="outline" className="mt-3" disabled>
                Download Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
