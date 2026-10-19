import { useState } from 'react';
import { Plus, RefreshCw, Users, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAudienceSegments, useDeleteSegment, useRecalculateSegment } from '../hooks/use-audience-segments';
import { SegmentDrawer } from '../drawers/segment-drawer';
import type { AudienceSegment } from '../types/automation';

const SEGMENT_TYPE_COLORS: Record<string, string> = {
  demographic:   'bg-purple-100 text-purple-700',
  geographic:    'bg-blue-100 text-blue-700',
  behavioral:    'bg-green-100 text-green-700',
  transactional: 'bg-yellow-100 text-yellow-700',
  marketing:     'bg-pink-100 text-pink-700',
  business:      'bg-orange-100 text-orange-700',
  operational:   'bg-cyan-100 text-cyan-700',
  custom:        'bg-gray-100 text-gray-700',
};

export function AudienceSegmentsPage() {
  const { t } = useTranslation('marketing');
  const [search, setSearch]             = useState('');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [selected, setSelected]         = useState<AudienceSegment | undefined>();

  const { data, isLoading } = useAudienceSegments({ search: search || undefined });
  const deleteSegment       = useDeleteSegment();
  const recalculate         = useRecalculateSegment();

  const segments = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">{t($ => $.audiences.title)}</h1>
          <p className="text-xs text-muted-foreground">{t($ => $.audiences.pageSubtitle)}</p>
        </div>
        <Button size="sm" onClick={() => { setSelected(undefined); setDrawerOpen(true); }}>
          <Plus className="h-3.5 w-3.5 me-1" /> {t($ => $.audiences.actions.new)}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b">
        <Input
          placeholder={t($ => $.audiences.search)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-64"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t($ => $.audiences.loading)}</div>
        ) : segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t($ => $.audiences.empty)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {segments.map(seg => (
              <div key={seg.id} className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{seg.name}</p>
                    {seg.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{seg.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelected(seg); setDrawerOpen(true); }}>{t($ => $.common.edit)}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => recalculate.mutate(seg.id)} disabled={recalculate.isPending}>
                        <RefreshCw className="h-3.5 w-3.5 me-2" /> {t($ => $.audiences.actions.recalculate)}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteSegment.mutate(seg.id)}
                      >
                        {t($ => $.common.delete)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEGMENT_TYPE_COLORS[seg.segment_type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {t($ => $.audiences.segmentType[seg.segment_type], { defaultValue: seg.segment_type })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {seg.is_dynamic ? t($ => $.audiences.dynamic) : t($ => $.audiences.static)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t($ => $.audiences.members, { count: seg.member_count })}
                  </span>
                  {seg.last_calculated_at && (
                    <span>{t($ => $.audiences.updatedOn, { date: new Date(seg.last_calculated_at).toLocaleDateString() })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SegmentDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelected(undefined); }}
        segment={selected}
      />
    </div>
  );
}

