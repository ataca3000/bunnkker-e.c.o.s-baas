<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Events\LoadingSessionCreated;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Services\LoadingSessionNumberGenerator;

final class CreateLoadingSessionAction
{
    public function __construct(
        private readonly LoadingSessionNumberGenerator $numberGen,
    ) {}

    public function execute(
        string $companyId,
        string $warehouseId,
        string $operationalDate,
        string $actorId,
        string $sessionType = 'standard',
        ?string $notes = null,
    ): LoadingSession {
        return DB::transaction(function () use ($companyId, $warehouseId, $operationalDate, $sessionType, $actorId, $notes): LoadingSession {
            $number = $this->numberGen->next($companyId);

            $session = LoadingSession::create([
                'company_id' => $companyId,
                'warehouse_id' => $warehouseId,
                'session_number' => $number,
                'operational_date' => $operationalDate,
                'status' => LoadingSessionStatus::Draft->value,
                'session_type' => $sessionType,
                'notes' => $notes,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            event(new LoadingSessionCreated(
                companyId: $companyId,
                sessionId: $session->id,
                sessionNumber: $number,
                warehouseId: $warehouseId,
                operationalDate: $operationalDate,
                sessionType: $sessionType,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $session;
        });
    }
}
