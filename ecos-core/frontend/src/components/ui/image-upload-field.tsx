import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

type ImageUploadFieldProps = {
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
};

/**
 * Reusable image picker with preview, replace and remove.
 * Calls onChange(file) when a new file is selected, onChange(null) to clear.
 */
export function ImageUploadField({ existingUrl, onChange }: ImageUploadFieldProps) {
  const resolvedExisting = getMediaUrl(existingUrl);
  const [preview,  setPreview]  = useState<string | null>(resolvedExisting);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync preview when the existing URL prop changes (e.g. drawer reused for a
  // different record). Only syncs when the user has not picked a new local file.
  //
  // `fileName` is a real dependency: with it listed, clearing a local pick
  // restores the record's existing image instead of leaving the preview blank.
  useEffect(() => {
    if (!fileName) {
      setPreview(getMediaUrl(existingUrl));
    }
  }, [existingUrl, fileName]);

  function handleFile(file: File | null) {
    if (!file) {
      setPreview(resolvedExisting);
      setFileName(null);
      onChange(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    onChange(file);
  }

  return (
    <div className="flex items-start gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={cn(
          'relative size-24 rounded-lg border-2 border-dashed cursor-pointer',
          'flex items-center justify-center overflow-hidden transition-colors hover:border-ring bg-muted/30',
          preview ? 'border-border' : 'border-input',
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
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="size-6" />
            <span className="text-[11px] font-medium">Upload</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">
          {fileName ?? (resolvedExisting ? 'Image set' : 'No image')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
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
            className="w-fit gap-1.5 text-muted-foreground"
            onClick={() => handleFile(null)}
          >
            <X className="size-3.5" />
            Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 5 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
