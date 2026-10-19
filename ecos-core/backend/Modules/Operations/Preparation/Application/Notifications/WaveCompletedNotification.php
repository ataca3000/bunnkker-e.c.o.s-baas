<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Notifications;

use Illuminate\Notifications\Notification;

final class WaveCompletedNotification extends Notification
{
    public function __construct(
        private readonly string $waveNumber,
        private readonly string $waveId,
        private readonly float $completionPct,
        private readonly int $poolEntriesCreated,
    ) {}

    /** @return list<string> */
    public function via(mixed $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toDatabase(mixed $notifiable): array
    {
        return [
            'type' => 'wave_completed',
            'wave_id' => $this->waveId,
            'wave_number' => $this->waveNumber,
            'message' => "Wave {$this->waveNumber} completed — {$this->poolEntriesCreated} products in Prepared Pool",
            'completion_pct' => $this->completionPct,
            'pool_entries_created' => $this->poolEntriesCreated,
            'severity' => 'success',
        ];
    }
}
