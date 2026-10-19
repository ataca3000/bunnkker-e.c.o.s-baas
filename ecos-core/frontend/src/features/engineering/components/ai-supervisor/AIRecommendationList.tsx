import type { AIRecommendation } from '../../types/engineering'
import { Lightbulb, CheckCircle2 } from 'lucide-react'

interface Props {
  recommendations: AIRecommendation[]
  onResolve: (recId: string) => void
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-orange-100 text-orange-800',
  medium:   'bg-yellow-100 text-yellow-800',
  low:      'bg-blue-100 text-blue-800',
}

const EFFORT_LABELS: Record<string, string> = {
  trivial: '~1h', low: '1d', medium: '3d', high: '1w', very_high: '2w+',
}

export function AIRecommendationList({ recommendations, onResolve }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Lightbulb className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No recommendations</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recommendations.map(rec => (
        <div key={rec.id} className={`rounded-lg border p-4 space-y-2 ${rec.is_resolved ? 'opacity-50' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[rec.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                {rec.priority.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{rec.category}</span>
              <span className="text-xs text-muted-foreground">• {EFFORT_LABELS[rec.effort_estimate] ?? rec.effort_estimate}</span>
            </div>
            {!rec.is_resolved && (
              <button
                onClick={() => onResolve(rec.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark Resolved
              </button>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{rec.title}</p>
          <p className="text-xs text-muted-foreground">{rec.description}</p>
        </div>
      ))}
    </div>
  )
}
