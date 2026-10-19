import { useRef, useState, type DragEvent } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

export type EcosImageUploadProps = {
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeMb?: number;
  disabled?: boolean;
};

/**
 * Image upload with drag-and-drop, preview, replace, and remove.
 * Replaces the legacy ImageUploadField with drag-and-drop support.
 */
export function EcosImageUpload({
  existingUrl,
  onChange,
  accept = 'image/png,image/jpeg,image/webp',
  maxSizeMb = 5,
  disabled = false,
}: EcosImageUploadProps) {
  const resolvedExisting = getMediaUrl(existingUrl);
  const [preview,  setPreview]  = useState<string | null>(resolvedExisting);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    setSizeError(null);
    if (!file) {
      setPreview(resolvedExisting);
      setFileName(null);
      onChange(null);
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setSizeError(`File must be smaller than ${maxSizeMb} MB`);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    onChange(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex items-start gap-4">
      {/* Drop zone / preview */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload image"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => !disabled && e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative size-24 rounded-lg border-2 border-dashed cursor-pointer overflow-hidden transition-colors',
          'flex items-center justify-center bg-muted/30',
          dragOver ? 'border-ring bg-primary/5' : preview ? 'border-border' : 'border-input',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="size-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="size-5 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground pointer-events-none">
            <ImageIcon className="size-6" />
            <span className="text-[11px] font-medium">
              {dragOver ? 'Drop here' : 'Upload'}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-1.5 pt-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">
          {fileName ?? (resolvedExisting ? 'Image set' : 'No image')}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-fit gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {preview ? 'Replace' : 'Choose Image'}
        </Button>

        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="w-fit gap-1.5 text-muted-foreground"
            onClick={() => handleFile(null)}
          >
            <X className="size-3.5" />
            Remove
          </Button>
        )}

        {sizeError
          ? <p className="text-xs text-destructive">{sizeError}</p>
          : <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to {maxSizeMb} MB</p>
        }
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
