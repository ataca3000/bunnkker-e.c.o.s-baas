import { ChevronDown, Eye, EyeOff, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  id:           string;
  icon:         React.ComponentType<{ className?: string }>;
  title:        string;
  color?:       string;
  badge?:       React.ReactNode;
  children:     React.ReactNode;

  // Controlled state — driven by useWorkspaceLayout
  collapsed:    boolean;
  hidden:       boolean;
  onToggle:     () => void;
  onHide:       () => void;
  onRestore:    () => void;

  // Drag-to-reorder
  onDragStart?: () => void;
  isDragOver?:  boolean;

  // Misc
  hideable?:    boolean;
  className?:   string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WidgetFrame({
  id,
  icon: Icon,
  title,
  color = 'text-muted-foreground',
  badge,
  children,
  collapsed,
  hidden,
  onToggle,
  onHide,
  onRestore,
  onDragStart,
  isDragOver = false,
  hideable   = true,
  className,
}: Props) {
  const { t } = useTranslation('dashboard');

  // ── Hidden: render a compact restore chip ──────────────────────────────
  if (hidden) {
    return (
      <button
        onClick={onRestore}
        className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/20 px-3 py-2 text-xs text-muted-foreground/60 transition-colors hover:border-muted-foreground/40 hover:text-muted-foreground"
        aria-label={`Restore ${title}`}
      >
        <Icon className={cn('h-3 w-3', color)} />
        <span>{title}</span>
        <Eye className="ml-1 h-3 w-3" />
        <span className="opacity-50">{t($ => $.widgetFrame.restore)}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-150',
        isDragOver && 'ring-2 ring-indigo-500 ring-offset-2',
        className,
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'group flex items-center gap-2 px-4 py-3',
          collapsed ? 'rounded-xl' : 'rounded-t-xl border-b',
        )}
      >
        {/* Drag handle — only shown when onDragStart is provided */}
        {onDragStart && (
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', id);
              onDragStart();
            }}
            className="flex cursor-grab items-center text-muted-foreground/30 opacity-0 transition-opacity hover:text-muted-foreground/60 group-hover:opacity-100 active:cursor-grabbing"
            title={t($ => $.widgetFrame.dragToReorder)}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Clickable area — toggle collapse */}
        <button
          onClick={onToggle}
          className="flex flex-1 cursor-pointer items-center gap-2 text-left"
          aria-expanded={!collapsed}
          aria-controls={`widget-body-${id}`}
        >
          <Icon className={cn('h-4 w-4 shrink-0', color)} />
          <h2 className="flex-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          {badge && <div className="shrink-0">{badge}</div>}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              !collapsed && 'rotate-180',
            )}
          />
        </button>

        {/* Hide button — visible on header hover */}
        {hideable && (
          <button
            onClick={onHide}
            title={`Hide ${title}`}
            className="ml-1 flex-shrink-0 rounded p-0.5 text-muted-foreground/0 transition-all hover:text-muted-foreground group-hover:text-muted-foreground/35"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div id={`widget-body-${id}`} className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
