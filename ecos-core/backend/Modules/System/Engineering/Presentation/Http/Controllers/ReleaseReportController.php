<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ReleaseReportService;
use Modules\System\Engineering\Application\Services\ReleaseRiskService;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseRisk;
use Modules\System\Traits\HasApiResponse;
final class ReleaseReportController
{
    use HasApiResponse;
    public function __construct(
        private readonly ReleaseReportService $reports,
        private readonly ReleaseRiskService $risks,
    ) {}

    public function index(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['reports' => $release->reports()->orderBy('report_type')->get()]);
    }

    public function generate(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['report_type' => 'nullable|string|in:executive_summary,engineering_summary,release_notes,risk_report,rollback_notes']);
        if (isset($data['report_type'])) {
            $method = match($data['report_type']) {
                'executive_summary'   => 'generateExecutiveSummary',
                'engineering_summary' => 'generateEngineeringSummary',
                'release_notes'       => 'generateChangelog',
                'risk_report'         => 'generateRiskReport',
                'rollback_notes'      => 'generateRollbackNotes',
            };
            return $this->success(['report' => $this->reports->$method($release)]);
        }
        return $this->success(['reports' => $this->reports->generateAll($release)]);
    }

    public function risks(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['risks' => $release->risks()->get()]);
    }

    public function acceptRisk(Request $request, EngineeringRelease $release, EngineeringReleaseRisk $risk): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $this->risks->acceptRisk($risk, auth()->id());
        return $this->success(['message' => 'Risk accepted']);
    }

    public function notes(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['notes' => $release->notes()->orderByDesc('is_pinned')->latest()->get()]);
    }

    public function storeNote(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['content' => 'required|string', 'note_type' => 'nullable|string', 'section' => 'nullable|string', 'is_public' => 'boolean', 'is_pinned' => 'boolean']);
        $note = $release->notes()->create(array_merge($data, ['company_id' => $release->company_id, 'authored_by' => auth()->id()]));
        return $this->success(['note' => $note], 201);
    }
}
