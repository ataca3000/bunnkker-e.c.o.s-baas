<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Notifications;

use Illuminate\Notifications\Notification;

final class ExceptionRaisedNotification extends Notification
{
    public function __construct(
        private readonly string $waveNumber,
        private readonly string $waveId,
        private readonly string $exceptionType,
        private readonly string $description,
        private readonly string $severity,
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
            'type' => 'exception_raised',
            'wave_id' => $this->waveId,
            'wave_number' => $this->waveNumber,
            'message' => "{$this->exceptionType} exception on wave {$this->waveNumber}",
            'exception_type' => $this->exceptionType,
            'description' => $this->description,
            'severity' => $this->severity,
        ];
    }
}
