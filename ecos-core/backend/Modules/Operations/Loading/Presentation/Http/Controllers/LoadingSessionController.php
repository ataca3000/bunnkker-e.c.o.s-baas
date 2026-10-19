<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Application\Actions\CancelLoadingSessionAction;
use Modules\Operations\Loading\Application\Actions\CloseLoadingSessionAction;
use Modules\Operations\Loading\Application\Actions\CompleteLoadingAction;
use Modules\Operations\Loading\Application\Actions\CreateLoadingSessionAction;
use Modules\Operations\Loading\Application\Actions\OpenLoadingSessionAction;
use Modules\Operations\Loading\Application\Actions\StartLoadingAction;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Presentation\Http\Requests\CancelLoadingSessionRequest;
use Modules\Operations\Loading\Presentation\Http\Requests\CreateLoadingSessionRequest;
use Modules\Operations\Loading\Presentation\Http\Resources\LoadingSessionResource;

final class LoadingSessionController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', LoadingSession::class);

        $request->validate([
            'status' => ['nullable', 'string'],
            'warehouse_id' => ['nullable', 'uuid'],
            'operational_date' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $companyId = $request->user()->company_id;
        $perPage = (int) ($request->query('per_page', 25));

        $query = LoadingSession::where('company_id', $companyId)
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($request->query('operational_date'), fn ($q, $v) => $q->whereDate('operational_date', $v))
            ->when($request->query('search'), fn ($q, $v) => $q->where('session_number', 'ilike', "%{$v}%"))
            ->orderByDesc('created_at');

        $paginator = $query->paginate($perPage);

        return $this->success([
            'data' => LoadingSessionResource::collection($paginator->items()),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(CreateLoadingSessionRequest $request, CreateLoadingSessionAction $action): JsonResponse
    {
        $this->authorize('create', LoadingSession::class);

        $validated = $request->validated();
        $session = $action->execute(
            companyId: $request->user()->company_id,
            warehouseId: $validated['warehouse_id'],
            operationalDate: $validated['operational_date'],
            actorId: (string) $request->user()->id,
            sessionType: $validated['session_type'] ?? 'standard',
            notes: $validated['notes'] ?? null,
        );

        return $this->created(new LoadingSessionResource($session));
    }

    public function show(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id, [
            'vehicleAssignments', 'loadingExceptions',
        ]);
        $this->authorize('view', $session);

        return $this->success(new LoadingSessionResource($session));
    }

    public function open(Request $request, string $sessionId, OpenLoadingSessionAction $action): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new LoadingSessionResource($result));
    }

    public function startLoading(Request $request, string $sessionId, StartLoadingAction $action): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new LoadingSessionResource($result));
    }

    public function completeLoading(Request $request, string $sessionId, CompleteLoadingAction $action): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new LoadingSessionResource($result));
    }

    public function cancel(CancelLoadingSessionRequest $request, string $sessionId, CancelLoadingSessionAction $action): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('cancel', $session);

        $result = $action->execute($session, (string) $request->user()->id, $request->validated('reason'));

        return $this->success([
            'id' => $result->id,
            'status' => $result->status instanceof BackedEnum ? $result->status->value : $result->status,
            'cancelled_at' => $result->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $result->cancellation_reason,
        ]);
    }

    public function close(Request $request, string $sessionId, CloseLoadingSessionAction $action): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('dispatch', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new LoadingSessionResource($result));
    }

    private function findSession(string $sessionId, string $companyId, array $relations = []): LoadingSession
    {
        $query = LoadingSession::where('id', $sessionId)->where('company_id', $companyId);

        if (! empty($relations)) {
            $query->with($relations);
        }

        $session = $query->first();

        if (! $session) {
            throw LoadingSessionNotFoundException::forId($sessionId);
        }

        return $session;
    }
}
