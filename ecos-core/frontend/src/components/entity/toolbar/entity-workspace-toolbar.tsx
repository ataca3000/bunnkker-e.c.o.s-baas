import type { ComponentType } from 'react';
import { Download, Plus, Search, Upload } from 'lucide-react';

import { PageToolbar } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { EntityToolbarConfig } from '../types';

type EntityWorkspaceToolbarProps = EntityToolbarConfig & {
  /**
   * Optional primary CTA rendered at the far right of the toolbar.
   * In most layouts the primary action lives in WorkspaceHeader instead;
   * use this when there is no header or when the toolbar needs its own CTA.
   */
  primaryLabel?: string;
  primaryIcon?: ComponentType<{ className?: string }>;
  onPrimary?: () => void;
  className?: string;
};

/**
 * Pre-composed toolbar for EntityWorkspace pages.
 *
 * Left   — search input (rendered when onSearchChange is provided)
 * Center — custom slot (view toggles, column presets, density controls, etc.)
 * Right  — Import → Export → extra slot → Primary CTA
 *
 * Consumed by EntityWorkspace; also usable standalone when a module needs
 * a standardised toolbar without the full EntityWorkspace shell.
 *
 * Extension points:
 *   extra       — inject column pickers, saved-view menus, AI actions, etc.
 *   center      — view-mode toggles, density switches
 *   onImport    — show the Import button
 *   onExport    — show the Export button
 *   onPrimary   — show a primary CTA (skip when WorkspaceHeader already has one)
 */
export function EntityWorkspaceToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  center,
  onImport,
  importLabel = 'Import',
  onExport,
  exportLabel = 'Export',
  extra,
  primaryLabel,
  primaryIcon,
  onPrimary,
  className,
}: EntityWorkspaceToolbarProps) {
  const PrimaryIcon = primaryIcon ?? Plus;

  const rightContent = onImport || onExport || extra || onPrimary ? (
    <>
      {onImport ? (
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="size-4" />
          {importLabel}
        </Button>
      ) : null}
      {onExport ? (
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-4" />
          {exportLabel}
        </Button>
      ) : null}
      {extra}
      {onPrimary ? (
        <Button size="sm" onClick={onPrimary}>
          <PrimaryIcon className="size-4" />
          {primaryLabel}
        </Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <PageToolbar
      className={className ?? 'px-4 sm:px-6'}
      left={
        onSearchChange ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full pl-8"
            />
          </div>
        ) : undefined
      }
      center={center}
      right={rightContent}
    />
  );
}
