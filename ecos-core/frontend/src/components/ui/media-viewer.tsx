'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpDown,
  Download,
  ExternalLink,
  FileText,
  Info,
  Maximize2,
  Minimize2,
  Paperclip,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/media';

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.25;
const ZOOM_MIN  = 0.25;
const ZOOM_MAX  = 5.0;

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif']);
const PDF_EXTS   = new Set(['pdf']);

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaKind = 'image' | 'pdf' | 'document';
type FitMode   = 'contain' | 'width' | 'height';

export interface MediaViewerMetadata {
  /** Original file name shown in the info panel. */
  filename?: string;
  /** Display name of the person who uploaded the file. */
  uploadedBy?: string;
  /** Human-readable upload date string. */
  uploadedAt?: string;
  /** MIME type string, e.g. "image/jpeg". */
  mimeType?: string;
  /** File size in bytes. */
  fileSizeBytes?: number;
  /** Native image width in pixels. */
  width?: number;
  /** Native image height in pixels. */
  height?: number;
}

export interface MediaViewerProps {
  /**
   * Raw storage path (e.g. "payment-proofs/abc.jpg").
   * Resolved internally via getMediaUrl(); never exposed to the DOM as-is.
   */
  path?: string | null;
  /**
   * Pre-resolved URL override. Used when the caller already holds a full URL.
   * If both path and url are provided, path takes precedence after resolution.
   */
  url?: string | null;
  /**
   * Element that opens the viewer on click.
   * When omitted the dialog must be driven via open/onOpenChange.
   */
  trigger?: React.ReactNode;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Dialog header title (defaults to the filename derived from the URL). */
  title?: string;
  /** Metadata shown in the collapsible info panel. */
  metadata?: MediaViewerMetadata;
  /** MIME type hint used when the file extension is ambiguous. */
  mimeType?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectKind(url: string, mimeType?: string): MediaKind {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'document';
  }
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (PDF_EXTS.has(ext))   return 'pdf';
  return 'document';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filenameFrom(url: string): string {
  return url.split('/').pop()?.split('?')[0] ?? 'attachment';
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface TBtnProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon: React.ReactNode;
}

function TBtn({ label, shortcut, onClick, disabled, active, icon }: TBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            active
              ? 'text-foreground bg-accent'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
        {shortcut && (
          <kbd className="ml-1.5 font-mono opacity-60">{shortcut}</kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Info row (metadata panel) ────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-foreground break-all">{value}</dd>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <kbd className="font-mono text-[10px] bg-muted border border-border/60 px-1.5 py-0.5 rounded text-foreground">
        {keys}
      </kbd>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MediaViewer({
  path,
  url: urlProp,
  trigger,
  open: openProp,
  onOpenChange,
  title,
  metadata,
  mimeType,
}: MediaViewerProps) {
  // ── Controlled vs uncontrolled ────────────────────────────────────────────
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // ── URL resolution ────────────────────────────────────────────────────────
  // Always resolve through getMediaUrl; fall back to urlProp only.
  const resolvedUrl = (path != null && path !== '' ? getMediaUrl(path) : null) ?? urlProp ?? null;
  const mimeHint    = mimeType ?? metadata?.mimeType;
  const kind        = resolvedUrl ? detectKind(resolvedUrl, mimeHint) : 'document';
  const derivedName = metadata?.filename ?? (resolvedUrl ? filenameFrom(resolvedUrl) : 'attachment');
  const dialogTitle = title ?? derivedName;

  // ── Image load state ──────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(true);
  const [hasError,  setHasError]  = useState(false);
  const [retryKey,  setRetryKey]  = useState(0);

  // ── Viewer state ──────────────────────────────────────────────────────────
  const [scale,       setScale]       = useState(1);
  const [rotation,    setRotation]    = useState(0);  // 0 | 90 | 180 | 270
  const [fitMode,     setFitMode]     = useState<FitMode>('contain');
  const [fullscreen,  setFullscreen]  = useState(false);
  const [showInfo,    setShowInfo]    = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // ── Reset when dialog opens/closes ───────────────────────────────────────
  useEffect(() => {
    if (open) {
      setScale(1);
      setRotation(0);
      setFitMode('contain');
      setLoading(true);
      setHasError(false);
      setRetryKey((k) => k + 1);
      setFullscreen(false);
    }
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const zoomIn  = useCallback(() => { setFitMode('contain'); setScale((s) => Math.min(ZOOM_MAX, +(s + ZOOM_STEP).toFixed(2))); }, []);
  const zoomOut = useCallback(() => { setFitMode('contain'); setScale((s) => Math.max(ZOOM_MIN, +(s - ZOOM_STEP).toFixed(2))); }, []);
  const resetZoom  = useCallback(() => { setScale(1); setFitMode('contain'); }, []);
  const fitWidth   = useCallback(() => setFitMode('width'),  []);
  const fitHeight  = useCallback(() => setFitMode('height'), []);
  const rotateLeft  = useCallback(() => setRotation((r) => (r - 90 + 360) % 360), []);
  const rotateRight = useCallback(() => setRotation((r) => (r + 90) % 360), []);
  const retry = useCallback(() => { setHasError(false); setLoading(true); setRetryKey((k) => k + 1); }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await contentRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, []);

  const download = useCallback(() => {
    if (!resolvedUrl) return;
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = derivedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resolvedUrl, derivedName]);

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault(); zoomIn();  break;
        case '-':
        case '_':
          e.preventDefault(); zoomOut(); break;
        case '0':
          e.preventDefault(); resetZoom(); break;
        case 'w': case 'W':
          e.preventDefault(); fitWidth();  break;
        case 'h': case 'H':
          e.preventDefault(); fitHeight(); break;
        case 'ArrowLeft':
          if (e.shiftKey) { e.preventDefault(); rotateLeft(); } break;
        case 'ArrowRight':
          if (e.shiftKey) { e.preventDefault(); rotateRight(); } break;
        case 'f': case 'F':
          e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, zoomIn, zoomOut, resetZoom, fitWidth, fitHeight, rotateLeft, rotateRight, toggleFullscreen]);

  // ── Image style computation ───────────────────────────────────────────────
  const rotate = rotation ? `rotate(${rotation}deg)` : undefined;

  const imgStyle = (): React.CSSProperties => {
    if (fitMode === 'width') {
      return { width: '100%', height: 'auto', transform: rotate };
    }
    if (fitMode === 'height') {
      return { width: 'auto', height: '100%', transform: rotate };
    }
    // contain / zoom
    const parts = [
      scale !== 1 ? `scale(${scale})` : '',
      rotate ?? '',
    ].filter(Boolean);

    return {
      maxWidth:     '100%',
      maxHeight:    '100%',
      objectFit:    'contain',
      transform:    parts.length ? parts.join(' ') : undefined,
      transformOrigin: 'center center',
      transition:   'transform 0.15s ease-out',
    };
  };

  // ── Dialog inner content ──────────────────────────────────────────────────
  const viewerBody = (
    <div ref={contentRef} className="flex flex-col h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0">
        <DialogPrimitive.Title className="text-sm font-semibold text-foreground flex-1 truncate min-w-0">
          {dialogTitle}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogPrimitive.Close>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={400}>
        <div className="flex items-center gap-0.5 px-2 h-10 border-b bg-muted/20 flex-shrink-0 flex-wrap">
          {/* Zoom */}
          <TBtn label="Zoom In"    shortcut="+"  onClick={zoomIn}    icon={<ZoomIn   className="h-3.5 w-3.5" />} disabled={kind !== 'image'} />
          <TBtn label="Zoom Out"   shortcut="−"  onClick={zoomOut}   icon={<ZoomOut  className="h-3.5 w-3.5" />} disabled={kind !== 'image'} />
          <TBtn label="Reset Zoom" shortcut="0"  onClick={resetZoom} icon={<RefreshCcw className="h-3.5 w-3.5" />} disabled={kind !== 'image'} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Fit */}
          <TBtn label="Fit Width"  shortcut="W"  onClick={fitWidth}  icon={<ArrowLeftRight className="h-3.5 w-3.5" />} disabled={kind !== 'image'} active={fitMode === 'width'}  />
          <TBtn label="Fit Height" shortcut="H"  onClick={fitHeight} icon={<ArrowUpDown    className="h-3.5 w-3.5" />} disabled={kind !== 'image'} active={fitMode === 'height'} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Rotate */}
          <TBtn label="Rotate Left"  shortcut="⇧←" onClick={rotateLeft}  icon={<RotateCcw className="h-3.5 w-3.5" />} disabled={kind !== 'image'} />
          <TBtn label="Rotate Right" shortcut="⇧→" onClick={rotateRight} icon={<RotateCw  className="h-3.5 w-3.5" />} disabled={kind !== 'image'} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Zoom % indicator */}
          <span
            className="text-[11px] text-muted-foreground font-mono w-10 text-center select-none"
            aria-live="polite"
            aria-label={`Zoom level: ${Math.round(scale * 100)}%`}
          >
            {Math.round(scale * 100)}%
          </span>

          <div className="flex-1" />

          {/* Info panel toggle */}
          <TBtn
            label="File Info"
            onClick={() => setShowInfo((v) => !v)}
            icon={<Info className="h-3.5 w-3.5" />}
            active={showInfo}
          />

          {/* Full screen */}
          <TBtn
            label={fullscreen ? 'Exit Full Screen' : 'Full Screen'}
            shortcut="F"
            onClick={toggleFullscreen}
            icon={
              fullscreen
                ? <Minimize2 className="h-3.5 w-3.5" />
                : <Maximize2 className="h-3.5 w-3.5" />
            }
          />

          {/* Download */}
          {resolvedUrl && (
            <TBtn
              label="Download Original"
              onClick={download}
              icon={<Download className="h-3.5 w-3.5" />}
            />
          )}

          {/* Open in new tab */}
          {resolvedUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Open original in new tab"
                  asChild
                >
                  <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Open Original</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {/* ── Body (viewer + optional info panel) ─────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Viewer area */}
        <div className="flex-1 relative overflow-auto bg-muted/10 dark:bg-black/20">
          {!resolvedUrl ? (
            /* No source */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Paperclip className="h-10 w-10 opacity-30" />
              <p className="text-sm">No media source provided.</p>
            </div>
          ) : kind === 'image' ? (
            <div
              className="flex items-center justify-center"
              style={{ minWidth: '100%', minHeight: '100%', padding: '1rem' }}
            >
              {/* Loading skeleton */}
              {loading && !hasError && (
                <div className="absolute inset-4">
                  <Skeleton className="w-full h-full rounded-md" />
                </div>
              )}

              {/* Error state */}
              {hasError ? (
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <AlertTriangle className="h-12 w-12 text-destructive/50" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Unable to load attachment.</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      The file may have been deleted or storage is unavailable.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={retry}>
                    <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : (
                <img
                  key={retryKey}
                  src={resolvedUrl}
                  alt={derivedName}
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setHasError(true); }}
                  draggable={false}
                  className={cn(
                    'select-none rounded',
                    loading ? 'opacity-0' : 'opacity-100',
                  )}
                  style={imgStyle()}
                />
              )}
            </div>
          ) : kind === 'pdf' ? (
            <iframe
              src={resolvedUrl}
              title={derivedName}
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            /* Non-previewable */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <FileText className="h-14 w-14 opacity-25" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="text-xs">This file type cannot be previewed in the browser.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open attachment
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Info panel */}
        {showInfo && (
          <aside
            className="w-52 border-l bg-background flex-shrink-0 overflow-y-auto p-3 space-y-4"
            aria-label="File information"
          >
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                File Info
              </h3>
              <dl className="space-y-2.5">
                {derivedName && <InfoRow label="File Name" value={derivedName} />}
                {metadata?.mimeType && <InfoRow label="Type" value={metadata.mimeType} />}
                {metadata?.fileSizeBytes != null && (
                  <InfoRow label="Size" value={formatBytes(metadata.fileSizeBytes)} />
                )}
                {metadata?.width != null && metadata?.height != null && (
                  <InfoRow label="Resolution" value={`${metadata.width} × ${metadata.height}`} />
                )}
                {metadata?.uploadedBy && <InfoRow label="Uploaded By" value={metadata.uploadedBy} />}
                {metadata?.uploadedAt  && <InfoRow label="Uploaded At"  value={metadata.uploadedAt}  />}
              </dl>
            </section>

            <Separator />

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Keyboard Shortcuts
              </h3>
              <div className="space-y-1.5">
                <ShortcutRow keys="+ / −"  label="Zoom In / Out" />
                <ShortcutRow keys="0"       label="Reset Zoom"    />
                <ShortcutRow keys="W"       label="Fit Width"     />
                <ShortcutRow keys="H"       label="Fit Height"    />
                <ShortcutRow keys="⇧ ← / →" label="Rotate"       />
                <ShortcutRow keys="F"       label="Full Screen"   />
                <ShortcutRow keys="Esc"     label="Close"         />
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  );

  // ── Dialog shell ──────────────────────────────────────────────────────────
  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {trigger && (
        <DialogPrimitive.Trigger asChild>
          {trigger}
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        {/* Dark backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        {/* Viewer box */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50',
            '-translate-x-1/2 -translate-y-1/2',
            'w-[90vw] max-w-6xl h-[90vh]',
            'bg-background border rounded-xl shadow-2xl',
            'flex flex-col overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'focus:outline-none',
          )}
          // Allow dismiss on outside click (default Radix behaviour)
          aria-describedby={undefined}
        >
          {viewerBody}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Named alias for clarity at call sites.
export const EnterpriseMediaViewer = MediaViewer;
