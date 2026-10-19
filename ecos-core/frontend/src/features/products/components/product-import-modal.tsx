import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useImportProducts } from '@/features/products/hooks/use-products';
import { cn } from '@/lib/utils';

type ImportError = { row: number; message: string };

type ProductImportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ProductImportModal({ open, onOpenChange, onSuccess }: ProductImportModalProps) {
  const { t } = useTranslation('products');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: ImportError[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportProducts();

  function handleFile(f: File) {
    if (!f.name.match(/\.(csv|txt)$/i)) return;
    setFile(f);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!file) return;
    const res = await importMutation.mutateAsync(file);
    setResult(res);
    if (res.errors.length === 0) {
      onSuccess?.();
    }
  }

  function downloadErrorReport() {
    if (!result?.errors.length) return;
    const csv = ['Row,Error', ...result.errors.map((e) => `${e.row},"${e.message}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  }

  const isPending = importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t($ => $.importModal.title)}</DialogTitle>
          <DialogDescription>{t($ => $.importModal.description)}</DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        {!result ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <Upload className="size-8 text-muted-foreground" />
            {file ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} {t($ => $.importModal.clickToChange)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t($ => $.importModal.dropzone)}</p>
                <p className="text-xs text-muted-foreground">{t($ => $.importModal.dropzoneSize)}</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : null}

        {/* Result */}
        {result ? (
          <div className="flex flex-col gap-3">
            <Alert variant={result.errors.length === 0 ? 'default' : 'destructive'} className={result.errors.length === 0 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : ''}>
              {result.errors.length === 0 ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription className={result.errors.length === 0 ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                {result.success > 0 ? tAny('importModal.importedCount', { count: result.success }) : ''}
                {result.errors.length > 0 ? ` ${tAny('importModal.errorCount', { count: result.errors.length })}` : ''}
              </AlertDescription>
            </Alert>

            {result.errors.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t($ => $.importModal.rowHeader)}</th>
                      <th className="px-3 py-2 text-start font-medium">{t($ => $.importModal.errorHeader)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.errors.slice(0, 20).map((err) => (
                      <tr key={err.row}>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] h-4">{err.row}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {result?.errors.length ? (
            <Button variant="outline" size="sm" onClick={downloadErrorReport}>
              <Download className="size-3.5" />
              {t($ => $.importModal.downloadErrorReport)}
            </Button>
          ) : null}
          {result && result.errors.length === 0 ? (
            <Button onClick={handleClose}>{t($ => $.importModal.done)}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>{t($ => $.importModal.cancel)}</Button>
              <Button onClick={handleImport} disabled={!file || isPending}>
                {isPending ? t($ => $.importModal.importing) : t($ => $.importModal.import)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
