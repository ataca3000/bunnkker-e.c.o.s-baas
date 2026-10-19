import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import type { FitnessVerdict } from '../types/fleet';

/**
 * One visual language for "here is why you cannot do that".
 *
 * Generalised from LOG-005's retryBlockers() contract: any refusal in the
 * platform states its ordered reasons in the same response that refuses. A
 * screen that says "unfit" without saying why is not acceptable.
 */
export function BlockerList({ verdict, compact = false }: { verdict: FitnessVerdict; compact?: boolean }) {
  const { t } = useTranslation('logistics');
  const hasFindings = verdict.blockers.length > 0 || verdict.warnings.length > 0;

  if (!hasFindings) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-emerald-600" />
        {t($ => $.fleet.blockers.none)}
      </p>
    );
  }

  return (
    <ul className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {verdict.blockers.map((blocker) => (
        <li key={blocker} className="flex items-start gap-1.5 text-xs">
          <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
          <span>{blocker}</span>
        </li>
      ))}
      {verdict.warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" />
          <span>{warning}</span>
        </li>
      ))}
    </ul>
  );
}
