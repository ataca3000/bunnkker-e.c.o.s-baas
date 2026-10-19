<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Domain\Services\Customer360Service;
use Modules\Crm\Customers\Domain\Services\CustomerMergeService;
use Modules\Crm\Customers\Domain\Services\DuplicateDetectionService;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;

/** Duplicate detection and customer merge. */
class CustomerMergeController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(
        private readonly DuplicateDetectionService $duplicates,
        private readonly CustomerMergeService $merge,
        private readonly Customer360Service $profiles,
    ) {}

    public function duplicates(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->duplicates->candidatesFor($this->customer($request, $id))]);
    }

    public function detect(Request $request): JsonResponse
    {
        $v = $request->validate([
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'string', 'max:200'],
            'name' => ['nullable', 'string', 'max:200'],
        ]);

        $phones = ! empty($v['phone']) ? [\Modules\Crm\Customers\Domain\Models\CustomerPhone::normalize($v['phone'])] : [];
        $emails = ! empty($v['email']) ? [\Modules\Crm\Customers\Domain\Models\CustomerEmail::normalize($v['email'])] : [];

        return response()->json(['data' => $this->duplicates->candidates(
            $this->companyId($request), array_values(array_filter($phones)), array_values(array_filter($emails)), $v['name'] ?? null,
        )]);
    }

    public function merge(Request $request): JsonResponse
    {
        $v = $request->validate([
            'surviving_id' => ['required', 'string'],
            'merged_id' => ['required', 'string', 'different:surviving_id'],
        ]);

        $surviving = $this->customer($request, $v['surviving_id']);
        $merged = $this->customer($request, $v['merged_id']);

        $result = $this->merge->merge($surviving, $merged, $this->actorId($request));

        return response()->json(['data' => [
            'surviving' => $this->profiles->identity($result),
            'merged_id' => $merged->id,
        ]]);
    }
}
