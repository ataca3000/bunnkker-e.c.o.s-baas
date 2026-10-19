import type { ReleaseValidationCheck } from '../../types/engineering';
import { Badge } from '@/components/ui/badge';
interface Props { checks: ReleaseValidationCheck[]; score: number; onRunValidation: () => void; loading?: boolean; }
export default function ValidationPanel({ checks, score, onRunValidation, loading }: Props) {
  const passed  = checks.filter(c => c.passed).length;
  const failed  = checks.filter(c => !c.passed).length;
  const blocking = checks.filter(c => !c.passed && c.is_blocking).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{score}%</p>
            <p className="text-xs text-muted-foreground">Readiness</p>
          </div>
          <div className="text-sm space-y-0.5">
            <p className="text-emerald-600">✅ {passed} passed</p>
            <p className="text-red-500">❌ {failed} failed {blocking > 0 && <span className="text-red-700">({blocking} blocking)</span>}</p>
          </div>
        </div>
        <button onClick={onRunValidation} disabled={loading} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
          {loading ? 'Validating…' : 'Run Validation'}
        </button>
      </div>
      {checks.length > 0 && (
        <div className="divide-y text-sm">
          {checks.map(c => (
            <div key={c.id} className="py-2 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{c.passed ? '✅' : '❌'}</span>
                <div>
                  <p className="font-medium text-sm">{c.check_name}</p>
                  {c.message && <p className="text-xs text-muted-foreground">{c.message}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.is_blocking && !c.passed && <Badge variant="destructive" className="text-[10px]">Blocking</Badge>}
                <Badge variant={c.severity === 'error' ? 'destructive' : 'outline'} className="text-[10px]">{c.severity}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
