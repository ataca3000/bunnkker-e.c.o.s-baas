<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AIReviewEngine;

class AIDashboardController extends Controller
{
    use HasApiResponse;
    public function __construct(private readonly AIReviewEngine $reviewEngine) {}

    public function index(): JsonResponse
    {
        return $this->success($this->reviewEngine->getDashboard(auth()->user()->company_id));
    }
}
