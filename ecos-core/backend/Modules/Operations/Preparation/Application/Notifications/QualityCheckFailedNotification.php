<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Notifications;

use Illuminate\Notifications\Notification;

final class QualityCheckFailedNotification extends Notification
{
    public function __construct(
        private readonly string $waveNumber,
        private readonly string $waveId,
        private readonly string $productSku,
        private readonly string $productName,
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
            'type' => 'quality_check_failed',
            'wave_id' => $this->waveId,
            'wave_number' => $this->waveNumber,
            'message' => "Quality check FAILED for {$this->productSku} in wave {$this->waveNumber}",
            'product_sku' => $this->productSku,
            'product_name' => $this->productName,
            'severity' => 'blocking',
        ];
    }
}
