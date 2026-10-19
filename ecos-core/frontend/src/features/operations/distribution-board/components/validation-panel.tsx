import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ValidationIssue } from '../types/distribution-board';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  ready: boolean;
}

export function ValidationPanel({ issues, ready }: ValidationPanelProps) {
  const errors   = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (ready) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 border-t bg-emerald-50 dark:bg-emerald-950/20 shrink-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
          Distribution plan is ready to finalize.
        </p>
        {warnings.length > 0 && (
          <span className="text-xs text-amber-700 dark:text-amber-400 ml-2">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="border-t bg-background shrink-0">
      <div className="px-4 py-2 flex flex-wrap gap-2">
        {errors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="text-xs text-destructive font-medium">
              {errors.length} error{errors.length !== 1 ? 's' : ''} blocking finalization
            </span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      <div className="px-4 pb-2 space-y-0.5 max-h-24 overflow-y-auto">
        {issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {issue.severity === 'error' ? (
              <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
            )}
            <span className={issue.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}>
              {issue.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
