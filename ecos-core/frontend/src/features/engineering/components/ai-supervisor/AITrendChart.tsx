import type { AITrend } from '../../types/engineering'

interface Props {
  trend: AITrend[]
  height?: number
}

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e'
  if (score >= 75) return '#facc15'
  if (score >= 60) return '#f97316'
  return '#ef4444'
}

export function AITrendChart({ trend, height = 120 }: Props) {
  if (!trend || trend.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
        Not enough data for trend chart
      </div>
    )
  }

  const W      = 600
  const H      = height
  const PAD    = 16
  const scores = trend.map(t => t.overall_score ?? 0)
  const min    = 0
  const max    = 100
  const xStep  = (W - 2 * PAD) / (scores.length - 1)

  const toX = (i: number) => PAD + i * xStep
  const toY = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - min) / (max - min))

  const pathD = scores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ')
  const areaD = `${pathD} L ${toX(scores.length - 1)} ${H - PAD} L ${toX(0)} ${H - PAD} Z`

  const lastScore  = scores[scores.length - 1]
  const firstScore = scores[0]
  const improving  = lastScore > firstScore + 2

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{trend[0].period_label}</span>
        <span className={improving ? 'text-green-600' : 'text-orange-500'}>
          {improving ? '↑' : '↓'} {Math.abs(lastScore - firstScore).toFixed(1)}pts
        </span>
        <span>{trend[trend.length - 1].period_label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[25, 50, 75].map(v => (
          <line
            key={v}
            x1={PAD} y1={toY(v)} x2={W - PAD} y2={toY(v)}
            stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"
          />
        ))}
        {/* Area fill */}
        <path d={areaD} fill={scoreColor(lastScore)} fillOpacity="0.12" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={scoreColor(lastScore)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {scores.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill={scoreColor(v)} />
        ))}
        {/* Last score label */}
        <text x={toX(scores.length - 1)} y={toY(lastScore) - 8} textAnchor="middle" fontSize="10" fill={scoreColor(lastScore)} fontWeight="600">
          {lastScore.toFixed(0)}
        </text>
      </svg>
    </div>
  )
}
