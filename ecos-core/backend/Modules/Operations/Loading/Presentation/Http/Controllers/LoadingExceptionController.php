<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Application\Actions\RaiseLoadingExceptionAction;
use Modules\Operations\Loading\Application\Actions\ResolveLoadingExceptionAction;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\LoadingException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Presentation\Http\Requests\RaiseExceptionRequest;
use Modules\Operations\Loading\Presentation\Http\Requests\ResolveExceptionRequest;
use Modules\Operations\Loading\Presentation\Http\Resources\LoadingExceptionResource;

final class LoadingExceptionController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('view', $session);

        $request->validate([
            'severity' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $exceptions = LoadingException::where('loading_session_id', $session->id)
            ->when($request->query('severity'), fn ($q, $v) => $q->where('severity', $v))
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->orderByDesc('created_at')
            ->get();

        return $this->success(LoadingExceptionResource::collection($exceptions));
    }

    public function store(
        RaiseExceptionRequest $request,
        string $sessionId,
        RaiseLoadingExceptionAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $validated = $request->validated();
        $exception = $action->execute(
            session: $session,
            exceptionType: $validated['exception_type'],
            severity: $validated['severity'],
            description: $validated['description'],
            actorId: (string) $request->user()->id,
            vehicleAssignmentId: $validated['vehicle_assignment_id'] ?? null,
            entityType: $validated['entity_type'] ?? null,
            entityId: $validated['entity_id'] ?? null,
        );

        return $this->created(new LoadingExceptionResource($exception));
    }

    public function resolve(
        ResolveExceptionRequest $request,
        string $sessionId,
        string $exceptionId,
        ResolveLoadingExceptionAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $exception = LoadingException::where('id', $exceptionId)
            ->where('loading_session_id', $session->id)
            ->first();

        if (! $exception) {
            abort(404, "Loading exception [{$exceptionId}] not found.");
        }

        $result = $action->execute(
            exception: $exception,
            actorId: (string) $request->user()->id,
            resolutionNotes: $request->validated('resolution_notes'),
        );

        return $this->success(new LoadingExceptionResource($result));
    }

    private function findSession(string $sessionId, string $companyId): LoadingSession
    {
        $session = LoadingSession::where('id', $sessionId)
            ->where('company_id', $companyId)
            ->first();

        if (! $session) {
            throw LoadingSessionNotFoundException::forId($sessionId);
        }

        return $session;
    }
}
