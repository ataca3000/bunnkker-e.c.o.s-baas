<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\ConfigAuditEntry;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;

/**
 * Manages company-level configuration settings.
 *
 * GET  /configuration/company              → all company settings (grouped)
 * GET  /configuration/company/{group}      → single group
 * PUT  /configuration/company/{group}      → update group (bulk key-value)
 * GET  /configuration/company/audit        → company-level audit trail
 */
final class CompanyConfigurationController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigurationManager $manager) {}

    public function index(): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';
        $settings = $this->manager->getCompanySettings($companyId);

        return $this->success($settings);
    }

    public function showGroup(string $group): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';
        $settings = $this->manager->getCompanySettings($companyId, $group);

        return $this->success([
            'group' => $group,
            'settings' => $settings,
        ]);
    }

    public function updateGroup(Request $request, string $group): JsonResponse
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable',
            'reason' => 'nullable|string|max:500',
        ]);

        $companyId = Auth::user()?->company_id ?? '';

        foreach ($validated['settings'] as $key => $value) {
            $this->manager->setCompanySetting(
                companyId: $companyId,
                group: $group,
                key: (string) $key,
                value: $value,
                reason: $validated['reason'] ?? null,
            );
        }

        return $this->updated(
            $this->manager->getCompanySettings($companyId, $group),
            'Company settings updated.',
        );
    }

    public function audit(Request $request): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';
        $limit = min((int) $request->query('limit', 50), 200);

        $entries = ConfigAuditEntry::where('company_id', $companyId)
            ->whereNull('brand_id')
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();

        return $this->success($entries);
    }
}
