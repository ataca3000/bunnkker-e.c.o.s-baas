import { api as axios } from '@/lib/axios'
import type {
  AIReview, AIDashboard, AIRisk, AIRecommendation,
  AIReleaseReview, AITrend,
} from '../types/engineering'

const BASE = '/system/engineering'

export const aiSupervisorService = {
  // Reviews
  listReviews: (params?: Record<string, unknown>) =>
    axios.get(BASE + '/ai-reviews', { params }).then(r => r.data.data),
  createReview: (data: { review_type?: string; subject_type?: string; subject_id?: string }) =>
    axios.post(BASE + '/ai-reviews', data).then(r => r.data.data),
  getReview: (id: string) =>
    axios.get(BASE + '/ai-reviews/' + id).then(r => r.data.data.review as AIReview),
  deleteReview: (id: string) =>
    axios.delete(BASE + '/ai-reviews/' + id).then(r => r.data),
  runReview: (id: string) =>
    axios.post(BASE + '/ai-reviews/' + id + '/run').then(r => r.data.data.review as AIReview),
  cancelReview: (id: string) =>
    axios.post(BASE + '/ai-reviews/' + id + '/cancel').then(r => r.data),
  getResults: (id: string) =>
    axios.get(BASE + '/ai-reviews/' + id + '/results').then(r => r.data.data),

  // Scores
  getScores: (reviewId: string) =>
    axios.get(BASE + '/ai-reviews/' + reviewId + '/scores').then(r => r.data.data.scores),
  getArchitectureChecks: (reviewId: string) =>
    axios.get(BASE + '/ai-reviews/' + reviewId + '/architecture-checks').then(r => r.data.data),
  getSecurityChecks: (reviewId: string) =>
    axios.get(BASE + '/ai-reviews/' + reviewId + '/security-checks').then(r => r.data.data),

  // Risks
  getRisks: (reviewId: string) =>
    axios.get(BASE + '/ai-reviews/' + reviewId + '/risks').then(r => r.data.data.risks as AIRisk[]),
  acknowledgeRisk: (reviewId: string, riskId: string) =>
    axios.post(BASE + '/ai-reviews/' + reviewId + '/risks/' + riskId + '/acknowledge').then(r => r.data),

  // Recommendations
  getRecommendations: (reviewId: string) =>
    axios.get(BASE + '/ai-reviews/' + reviewId + '/recommendations').then(r => r.data.data.recommendations as AIRecommendation[]),
  resolveRecommendation: (reviewId: string, recId: string) =>
    axios.post(BASE + '/ai-reviews/' + reviewId + '/recommendations/' + recId + '/resolve').then(r => r.data),
  getOpenRecommendations: () =>
    axios.get(BASE + '/ai-supervisor/recommendations/open').then(r => r.data.data.recommendations as AIRecommendation[]),

  // Dashboard
  getDashboard: () =>
    axios.get(BASE + '/ai-supervisor/dashboard').then(r => r.data.data as AIDashboard),

  // Trends
  getDailyTrend: (days = 30) =>
    axios.get(BASE + '/ai-supervisor/trends/daily', { params: { days } }).then(r => r.data.data.trend as AITrend[]),
  getWeeklyTrend: (weeks = 12) =>
    axios.get(BASE + '/ai-supervisor/trends/weekly', { params: { weeks } }).then(r => r.data.data.trend as AITrend[]),
  getMonthlyTrend: (months = 6) =>
    axios.get(BASE + '/ai-supervisor/trends/monthly', { params: { months } }).then(r => r.data.data.trend as AITrend[]),
  getScoreTrend: (period_type = 'daily', limit = 30) =>
    axios.get(BASE + '/ai-supervisor/trends/score', { params: { period_type, limit } }).then(r => r.data.data.score_trend),

  // Learning
  getRecurringIssues: (days = 30) =>
    axios.get(BASE + '/ai-supervisor/learning/recurring-issues', { params: { days } }).then(r => r.data.data.issues),
  getPatterns: () =>
    axios.get(BASE + '/ai-supervisor/learning/patterns').then(r => r.data.data.patterns),
  getMetrics: () =>
    axios.get(BASE + '/ai-supervisor/metrics').then(r => r.data.data.metrics),

  // Release review
  triggerReleaseReview: (releaseId: string) =>
    axios.post(BASE + '/releases/' + releaseId + '/ai-review').then(r => r.data.data),
  getReleaseReview: (releaseId: string) =>
    axios.get(BASE + '/releases/' + releaseId + '/ai-review').then(r => r.data.data.release_review as AIReleaseReview | null),
  getReleaseRecommendation: (releaseId: string) =>
    axios.get(BASE + '/releases/' + releaseId + '/ai-review/recommendation').then(r => r.data.data),
}
