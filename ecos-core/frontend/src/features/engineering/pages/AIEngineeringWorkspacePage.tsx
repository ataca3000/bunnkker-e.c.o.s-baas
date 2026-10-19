import { useState } from 'react'
import { Bot, Play, RefreshCw, ShieldAlert, Lightbulb, TrendingUp, Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useAIDashboard, useAIReviews, useAITrend } from '../hooks/useAISupervisor'
import { EngineeringScoreCard } from '../components/ai-supervisor/EngineeringScoreCard'
import { AIRiskViewer } from '../components/ai-supervisor/AIRiskViewer'
import { AIRecommendationList } from '../components/ai-supervisor/AIRecommendationList'
import { AITrendChart } from '../components/ai-supervisor/AITrendChart'
import { REVIEW_RECOMMENDATION_LABELS, REVIEW_RECOMMENDATION_COLORS, REVIEW_STATUS_LABELS } from '../types/engineering'

const TABS = ['Overview', 'Risks', 'Recommendations', 'Trends'] as const
type Tab = typeof TABS[number]

function RecommendationBadge({ value }: { value: string | undefined | null }) {
  if (!value) return null
  const label = REVIEW_RECOMMENDATION_LABELS[value as keyof typeof REVIEW_RECOMMENDATION_LABELS] ?? value
  const color = REVIEW_RECOMMENDATION_COLORS[value as keyof typeof REVIEW_RECOMMENDATION_COLORS] ?? 'text-gray-600'
  const bg: Record<string, string> = {
    approve:               'bg-green-50 border-green-200',
    approve_with_warnings: 'bg-yellow-50 border-yellow-200',
    needs_review:          'bg-orange-50 border-orange-200',
    reject:                'bg-red-50 border-red-200',
    critical_block:        'bg-red-100 border-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-semibold ${bg[value] ?? 'bg-gray-50 border-gray-200'} ${color}`}>
      {value === 'approve' && <CheckCircle className="h-3.5 w-3.5" />}
      {value === 'critical_block' && <XCircle className="h-3.5 w-3.5" />}
      {(value === 'approve_with_warnings' || value === 'needs_review') && <AlertTriangle className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

export default function AIEngineeringWorkspacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const { dashboard, refresh: refreshDash } = useAIDashboard(60_000)
  const { reviews, selected, risks, recs, running, selectReview, createAndRun, acknowledgeRisk, resolveRecommendation } = useAIReviews()
  const { trend, loading: trendLoading } = useAITrend()

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Engineering Supervisor</h1>
            <p className="text-xs text-muted-foreground">Automated quality gate before every release</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshDash}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={createAndRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? 'Running Review…' : 'Run AI Review'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Overall Score', value: dashboard.overall_score != null ? `${dashboard.overall_score.toFixed(1)}%` : 'N/A', icon: <Activity className="h-4 w-4 text-purple-500" /> },
            { label: 'Critical Risks', value: String(dashboard.critical_risks?.length ?? 0), icon: <ShieldAlert className="h-4 w-4 text-red-500" /> },
            { label: 'Open Recommendations', value: String(dashboard.open_recommendations?.length ?? 0), icon: <Lightbulb className="h-4 w-4 text-yellow-500" /> },
            { label: 'Reviews This Month', value: String(dashboard.review_count_this_month ?? 0), icon: <TrendingUp className="h-4 w-4 text-green-500" /> },
          ].map(kpi => (
            <div key={kpi.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex-shrink-0">{kpi.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation banner */}
      {dashboard?.recommendation && (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Latest Recommendation:</span>
          <RecommendationBadge value={dashboard.recommendation} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Score card */}
          <div className="lg:col-span-1">
            {selected ? (
              <EngineeringScoreCard review={selected} scores={selected.scores ?? []} />
            ) : dashboard?.latest_review ? (
              <EngineeringScoreCard review={dashboard.latest_review} scores={dashboard.scores_by_dimension ?? []} />
            ) : (
              <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                Run a review to see scores
              </div>
            )}
          </div>

          {/* Review history list */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Reviews</h2>
            </div>
            <div className="divide-y divide-border">
              {reviews.slice(0, 8).map(r => (
                <button
                  key={r.id}
                  onClick={() => selectReview(r.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors ${selected?.id === r.id ? 'bg-muted/50' : ''}`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      {REVIEW_STATUS_LABELS[r.status]} — {r.review_type}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(r.triggered_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.overall_score != null && (
                      <span className="text-sm font-bold text-foreground">{r.overall_score.toFixed(0)}%</span>
                    )}
                    {r.recommendation && <RecommendationBadge value={r.recommendation} />}
                  </div>
                </button>
              ))}
              {reviews.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No reviews yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Risks' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Detected Risks</h2>
            {risks.length > 0 && (
              <span className="text-xs text-muted-foreground">{risks.filter(r => !r.is_acknowledged).length} unacknowledged</span>
            )}
          </div>
          <AIRiskViewer
            risks={selected ? risks : (dashboard?.critical_risks ?? [])}
            onAcknowledge={(riskId) => selected && acknowledgeRisk(selected.id, riskId)}
          />
        </div>
      )}

      {activeTab === 'Recommendations' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recommendations</h2>
            {recs.length > 0 && (
              <span className="text-xs text-muted-foreground">{recs.filter(r => !r.is_resolved).length} open</span>
            )}
          </div>
          <AIRecommendationList
            recommendations={selected ? recs : (dashboard?.open_recommendations ?? [])}
            onResolve={(recId) => selected && resolveRecommendation(selected.id, recId)}
          />
        </div>
      )}

      {activeTab === 'Trends' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Score Trend (30 days)</h2>
              {dashboard && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Architecture: {dashboard.architecture_compliance_rate?.toFixed(0)}%</span>
                  <span>Security: {dashboard.security_pass_rate?.toFixed(0)}%</span>
                </div>
              )}
            </div>
            {trendLoading ? (
              <div className="h-24 animate-pulse bg-muted rounded" />
            ) : (
              <AITrendChart trend={trend} height={140} />
            )}
          </div>

          {/* Patterns */}
          {dashboard && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total Reviews', value: dashboard.review_count_total },
                { label: 'This Month', value: dashboard.review_count_this_month },
                { label: 'Architecture Compliance', value: `${(dashboard.architecture_compliance_rate ?? 0).toFixed(0)}%` },
                { label: 'Security Pass Rate', value: `${(dashboard.security_pass_rate ?? 0).toFixed(0)}%` },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
