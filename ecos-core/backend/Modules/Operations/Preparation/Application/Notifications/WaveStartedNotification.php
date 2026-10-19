<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Notifications;

use Illuminate\Notifications\Notification;

final class WaveStartedNotification extends Notification
{
    public function __construct(
        private readonly string $waveNumber,
        private readonly string $waveId,
        private readonly string $role,
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
            'type' => 'wave_started',
            'wave_id' => $this->waveId,
            'wave_number' => $this->waveNumber,
            'message' => "You've been assigned to wave {$this->waveNumber} as {$this->role}",
            'severity' => 'info',
        ];
    }
}
