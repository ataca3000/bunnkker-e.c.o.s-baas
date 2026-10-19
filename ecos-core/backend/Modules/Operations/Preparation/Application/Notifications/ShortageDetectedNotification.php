<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class ShortageDetectedNotification extends Notification
{
    /** @param list<array<string, mixed>> $shortages */
    public function __construct(
        private readonly string $waveNumber,
        private readonly string $waveId,
        private readonly array $shortages,
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
            'type' => 'shortage_detected',
            'wave_id' => $this->waveId,
            'wave_number' => $this->waveNumber,
            'message' => "Wave {$this->waveNumber} blocked — material shortage detected",
            'shortages' => $this->shortages,
            'severity' => 'blocking',
        ];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Wave {$this->waveNumber} — Shortage Detected")
            ->line("Wave {$this->waveNumber} is blocked due to a material shortage.")
            ->line(count($this->shortages).' material(s) are below required levels.')
            ->action('View Wave', url("/operations/preparation/waves?search={$this->waveNumber}"));
    }
}
