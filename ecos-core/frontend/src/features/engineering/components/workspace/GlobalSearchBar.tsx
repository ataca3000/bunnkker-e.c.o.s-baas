import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/router/routes';
import { workspaceService, type WorkspaceSearchResults } from '../../services/workspace-service';

export function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkspaceSearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await workspaceService.search(query.trim()));
    } finally {
      setSearching(false);
    }
  };

  const total = results
    ? results.repair_sessions.length + results.guardian_runs.length + results.releases.length + results.insights.length
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          placeholder="Search sessions, runs, releases, insights…"
          aria-label="Global engineering search"
          className="max-w-md"
        />
        <Button onClick={() => void runSearch()} disabled={searching || query.trim().length < 2}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {results && (
        <div className="rounded-md border p-3 text-sm space-y-3">
          {total === 0 && <p className="text-muted-foreground">No matches.</p>}

          {results.repair_sessions.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Repair sessions</p>
              {results.repair_sessions.map((row) => (
                <button
                  key={String(row.id)}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => navigate(ROUTES.engineeringRepair)}
                >
                  <Badge variant="outline" className="me-2">{String(row.status)}</Badge>
                  {String(row.failure_summary)}
                </button>
              ))}
            </div>
          )}

          {results.guardian_runs.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Guardian runs</p>
              {results.guardian_runs.map((row) => (
                <div key={String(row.id)} className="truncate px-2 py-1">
                  <Badge variant="outline" className="me-2">{String(row.decision ?? row.status)}</Badge>
                  {String(row.branch ?? row.commit_ref ?? row.id)}
                </div>
              ))}
            </div>
          )}

          {results.releases.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Releases</p>
              {results.releases.map((row) => (
                <button
                  key={String(row.id)}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => navigate(ROUTES.engineeringReleases)}
                >
                  {String(row.name)} v{String(row.version)}
                </button>
              ))}
            </div>
          )}

          {results.insights.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Insights</p>
              {results.insights.map((row) => (
                <div key={String(row.id)} className="truncate px-2 py-1">
                  <Badge variant="outline" className="me-2">{String(row.severity)}</Badge>
                  {String(row.title)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
