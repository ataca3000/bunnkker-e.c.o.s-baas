<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Engagement\Domain\Enums\ActivityType;
use Modules\Crm\Engagement\Domain\Models\CustomerActivity;
use Modules\Crm\Engagement\Domain\Services\ActivityService;

/**
 * Logging and listing CRM-owned activities (calls, emails, WhatsApp/Messenger,
 * notes, meetings). The log is append-only.
 */
class ActivityController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly ActivityService $activities) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        $rows = CustomerActivity::query()
            ->where('company_id', $this->companyId($request))
            ->where('customer_id', $customer->id)
            ->when($request->filled('type'), fn ($q) => $q->where('activity_type', $request->string('type')))
            ->orderByDesc('occurred_at')
            ->limit(200)->get()
            ->map(fn (CustomerActivity $a) => [
                'id' => $a->id,
                'type' => $a->activity_type->value,
                'direction' => $a->direction?->value,
                'channel' => $a->channel,
                'subject' => $a->subject,
                'body' => $a->body,
                'outcome' => $a->outcome,
                'occurred_at' => $a->occurred_at?->toIso8601String(),
                'actor_id' => $a->actor_id,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function log(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(ActivityType::values())],
            'direction' => ['nullable', Rule::in(['inbound', 'outbound', 'internal'])],
            'channel' => ['nullable', 'string', 'max:20'],
            'subject' => ['nullable', 'string', 'max:200'],
            'body' => ['nullable', 'string'],
            'outcome' => ['nullable', 'string', 'max:120'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $customer = $this->customer($request, $id);
        $activity = $this->activities->log(
            $this->companyId($request), (string) $customer->id, ActivityType::from($validated['type']),
            array_merge($validated, ['actor_id' => $this->actorId($request)]),
        );

        return response()->json(['data' => ['id' => $activity->id, 'type' => $activity->activity_type->value, 'occurred_at' => $activity->occurred_at?->toIso8601String()]], 201);
    }
}
