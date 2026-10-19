import type { AIScore, AIReview } from '../../types/engineering'

interface Props {
  review: AIReview
  scores: AIScore[]
}

const DIM_ICONS: Record<string, string> = {
  architecture: '🏗️', backend: '⚙️', frontend: '🎨', database: '🗄️',
  security: '🔒', testing: '🧪', documentation: '📄', performance: '⚡', maintainability: '🔧',
}

const DIM_ORDER = ['architecture', 'backend', 'frontend', 'database', 'security', 'testing', 'documentation', 'performance', 'maintainability']

function scoreColor(score: number): string {
  if (score >= 90) return 'bg-green-500'
  if (score >= 75) return 'bg-yellow-400'
  if (score >= 60) return 'bg-orange-400'
  return 'bg-red-500'
}

function scoreText(score: number): string {
  if (score >= 90) return 'text-green-700 dark:text-green-400'
  if (score >= 75) return 'text-yellow-700 dark:text-yellow-400'
  if (score >= 60) return 'text-orange-700 dark:text-orange-400'
  return 'text-red-700 dark:text-red-400'
}

export function EngineeringScoreCard({ review, scores }: Props) {
  const overall = review.overall_score ?? 0
  const sorted  = DIM_ORDER.map(d => scores.find(s => s.dimension === d)).filter(Boolean) as AIScore[]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Overall */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Score</p>
          <p className={`text-4xl font-bold ${scoreText(overall)}`}>{overall.toFixed(1)}%</p>
        </div>
        <div className="w-20 h-20 relative">
          <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3.8" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={overall >= 90 ? '#22c55e' : overall >= 75 ? '#facc15' : overall >= 60 ? '#f97316' : '#ef4444'}
              strokeWidth="3.8"
              strokeDasharray={`${overall} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreText(overall)}`}>
            {Math.round(overall)}
          </span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-2.5">
        {sorted.map(s => (
          <div key={s.dimension} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span>{DIM_ICONS[s.dimension] ?? '•'}</span>
                <span className="capitalize">{s.dimension}</span>
                <span className="text-muted-foreground">({s.weight}%)</span>
              </span>
              <span className={`font-semibold ${scoreText(s.score)}`}>{s.score.toFixed(0)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreColor(s.score)}`}
                style={{ width: `${Math.min(100, s.score)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
