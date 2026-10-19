<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\RepairSession;

class RepairPatchController
{
    use HasApiResponse;

    public function forSession(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        return $this->success(
            $session->patches()->orderByDesc('created_at')->get(),
        );
    }
}
