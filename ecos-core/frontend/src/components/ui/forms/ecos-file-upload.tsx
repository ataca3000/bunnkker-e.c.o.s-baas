import { useRef, useState, type DragEvent } from 'react';
import { FileText, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EcosFileEntry = {
  id: string;
  name: string;
  file: File;
  /** 0–100, undefined = not yet started, -1 = error */
  progress?: number;
  error?: string;
};

export type EcosFileUploadProps = {
  entries: EcosFileEntry[];
  onChange: (entries: EcosFileEntry[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Multi-file upload with drag-and-drop, per-file progress bars,
 * remove, and retry. Progress is controlled externally via entries[].progress.
 */
export function EcosFileUpload({
  entries,
  onChange,
  accept,
  multiple = true,
  maxSizeMb = 10,
  maxFiles,
  disabled = false,
  className,
}: EcosFileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const newEntries: EcosFileEntry[] = [];

    Array.from(files).forEach((file) => {
      if (maxFiles && entries.length + newEntries.length >= maxFiles) return;
      newEntries.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        file,
        error: file.size > maxSizeBytes ? `Exceeds ${maxSizeMb} MB limit` : undefined,
      });
    });

    if (newEntries.length) onChange([...entries, ...newEntries]);
  }

  function remove(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  function retry(id: string) {
    onChange(entries.map((e) => e.id === id ? { ...e, progress: undefined, error: undefined } : e));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  const atMax = Boolean(maxFiles && entries.length >= maxFiles);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Drop zone */}
      {!atMax && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload files"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => !disabled && e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors',
            dragOver ? 'border-ring bg-primary/5 text-primary' : 'border-input text-muted-foreground hover:border-ring hover:bg-muted/40',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <Upload className="size-6" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {dragOver ? 'Drop to upload' : 'Drag files here or click to browse'}
            </p>
            <p className="text-xs mt-0.5">
              {accept ? `Accepted: ${accept}` : 'Any file type'} — up to {maxSizeMb} MB each
              {maxFiles ? ` — max ${maxFiles} file${maxFiles > 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <div className="rounded-md border divide-y overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate min-w-0">{entry.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(entry.file.size)}
                </span>

                {entry.error ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => retry(entry.id)}
                    title="Retry"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                ) : entry.progress !== undefined && entry.progress < 100 ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                ) : null}

                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Progress bar */}
              {entry.progress !== undefined && entry.progress >= 0 && entry.progress < 100 && (
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
              )}

              {entry.error && (
                <p className="text-xs text-destructive">{entry.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
