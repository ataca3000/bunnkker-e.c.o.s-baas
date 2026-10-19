<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\CloseSessionCommand;
use Modules\POS\Application\Commands\OpenSessionCommand;
use Modules\POS\Application\Services\CloseSessionService;
use Modules\POS\Application\Services\FindSessionService;
use Modules\POS\Application\Services\OpenSessionService;
use Modules\POS\Presentation\Http\Requests\OpenSessionRequest;
use Modules\POS\Presentation\Http\Resources\SessionResource;

final class SessionController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly OpenSessionService $openSessionService,
        private readonly FindSessionService $findSessionService,
        private readonly CloseSessionService $closeSessionService,
    ) {}

    public function store(OpenSessionRequest $request): JsonResponse
    {
        $data = $request->validated();

        /** @var \App\Models\User $user */
        $user = $request->user();

        // Derive a stable deterministic UUID from the integer user ID so the
        // pos_sessions.cashier_id (uuid column) always resolves to the same
        // value for a given ECOS user without requiring a schema change.
        $cashierId = \Ramsey\Uuid\Uuid::uuid5(
            \Ramsey\Uuid\Uuid::NAMESPACE_OID,
            'ecos:user:'.$user->id,
        )->toString();

        $command = new OpenSessionCommand(
            cashierId: $cashierId,
            companyId: $data['company_id'],
            channelId: $data['channel_id'] ?? null,
            warehouseId: $data['warehouse_id'],
            deviceFingerprint: $data['device_fingerprint'] ?? substr((string) $request->userAgent(), 0, 64),
            ipAddress: $request->ip() ?? '0.0.0.0',
            deviceType: $data['device_type'] ?? 'browser',
        );

        $result = $this->openSessionService->execute($command);

        $session = $this->findSessionService->execute($result->sessionId);

        return $this->created(new SessionResource($session), 'Session opened.');
    }

    public function show(string $session): JsonResponse
    {
        $model = $this->findSessionService->execute($session);

        return $this->success(new SessionResource($model));
    }

    public function destroy(string $session): JsonResponse
    {
        $model = $this->findSessionService->execute($session);
        $command = new CloseSessionCommand(
            sessionId: (string) $model->id,
            cashierId: (string) $model->cashier_id,
        );

        $this->closeSessionService->execute($command);

        return $this->deleted('Session closed.');
    }
}
