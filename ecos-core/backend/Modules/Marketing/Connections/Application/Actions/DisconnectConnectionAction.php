<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Application\Actions;

use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Events\ConnectionDisconnected;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class DisconnectConnectionAction
{
    public function execute(
        MarketingConnection $connection,
        string $actorId,
        ?string $reason = null,
    ): MarketingConnection {
        $previousStatus = $connection->status->value;

        $connection->update([
            'status' => ConnectionStatus::Disconnected->value,
            'previous_status' => $previousStatus,
            'access_token' => null,
            'refresh_token' => null,
            'token_expires_at' => null,
            'disconnected_at' => now(),
            'disconnected_by' => $actorId,
        ]);

        event(new ConnectionDisconnected(
            connectionId: $connection->id,
            connectorType: $connection->connector_type,
            actorId: $actorId,
            previousStatus: $previousStatus,
            reason: $reason,
        ));

        return $connection->fresh() ?? $connection;
    }
}
