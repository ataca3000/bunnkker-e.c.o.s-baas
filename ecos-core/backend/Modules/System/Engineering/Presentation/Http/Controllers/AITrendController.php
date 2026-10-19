<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AITrendEngine;
use Modules\System\Engineering\Application\Services\AILearningEngine;
use Modules\System\Engineering\Application\Services\AIMetricsEngine;

class AITrendController extends Controller
{
    use HasApiResponse;
    public function __construct(
        private readonly AITrendEngine    $trendEngine,
        private readonly AILearningEngine $learningEngine,
        private readonly AIMetricsEngine  $metricsEngine,
    ) {}

    public function daily(Request $request): JsonResponse
    {
        $data = $this->trendEngine->getDailyTrend(auth()->user()->company_id, $request->integer('days', 30));
        return $this->success(['trend' => $data]);
    }

    public function weekly(Request $request): JsonResponse
    {
        $data = $this->trendEngine->getWeeklyTrend(auth()->user()->company_id, $request->integer('weeks', 12));
        return $this->success(['trend' => $data]);
    }

    public function monthly(Request $request): JsonResponse
    {
        $data = $this->trendEngine->getMonthlyTrend(auth()->user()->company_id, $request->integer('months', 6));
        return $this->success(['trend' => $data]);
    }

    public function scoreTrend(Request $request): JsonResponse
    {
        $data = $this->trendEngine->getScoreTrend(
            auth()->user()->company_id,
            $request->string('period_type', 'daily'),
            $request->integer('limit', 30)
        );
        return $this->success(['score_trend' => $data]);
    }

    public function recurringIssues(Request $request): JsonResponse
    {
        $data = $this->learningEngine->getRecurringIssues(auth()->user()->company_id, $request->integer('days', 30));
        return $this->success(['issues' => $data]);
    }

    public function patterns(): JsonResponse
    {
        $data = $this->learningEngine->analyzePatterns(auth()->user()->company_id);
        return $this->success(['patterns' => $data]);
    }

    public function metrics(): JsonResponse
    {
        $data = $this->metricsEngine->getAggregates(auth()->user()->company_id);
        return $this->success(['metrics' => $data]);
    }
}
