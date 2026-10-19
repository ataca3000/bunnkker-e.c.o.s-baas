import type { AIRisk } from '../../types/engineering'
import { RISK_SEVERITY_COLORS } from '../../types/engineering'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'

interface Props {
  risks: AIRisk[]
  onAcknowledge: (riskId: string) => void
}

export function AIRiskViewer({ risks, onAcknowledge }: Props) {
  if (risks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ShieldAlert className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No risks detected</p>
      </div>
    )
  }

  const sorted = [...risks].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-3">
      {sorted.map(risk => (
        <div key={risk.id} className={`rounded-lg border p-4 space-y-2 ${risk.is_acknowledged ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_SEVERITY_COLORS[risk.severity]}`}>
                {risk.severity.toUpperCase()}
              </span>
              {risk.is_blocking && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
                  BLOCKING
                </span>
              )}
              <span className="text-xs text-muted-foreground capitalize">{risk.category}</span>
            </div>
            {!risk.is_acknowledged && (
              <button
                onClick={() => onAcknowledge(risk.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Acknowledge
              </button>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{risk.title}</p>
          <p className="text-xs text-muted-foreground">{risk.description}</p>
          <div className="bg-muted rounded p-2">
            <p className="text-xs font-medium text-foreground">Recommendation</p>
            <p className="text-xs text-muted-foreground mt-0.5">{risk.recommendation}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
