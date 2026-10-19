<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;

use const DATE_ATOM;

final readonly class ReprintRecord
{
    public function __construct(
        public string $reprintId,
        public string $cashierId,
        public string $terminalId,
        public string $reprintedAt,
        public string $reason,
    ) {}

    public static function of(
        string $cashierId,
        string $terminalId,
        ReprintReason $reason,
    ): self {
        return new self(
            reprintId: self::generateUuid(),
            cashierId: $cashierId,
            terminalId: $terminalId,
            reprintedAt: (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DATE_ATOM),
            reason: $reason->value,
        );
    }

    public function toArray(): array
    {
        return [
            'reprint_id' => $this->reprintId,
            'cashier_id' => $this->cashierId,
            'terminal_id' => $this->terminalId,
            'reprinted_at' => $this->reprintedAt,
            'reason' => $this->reason,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            reprintId: $data['reprint_id'],
            cashierId: $data['cashier_id'],
            terminalId: $data['terminal_id'],
            reprintedAt: $data['reprinted_at'],
            reason: $data['reason'],
        );
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
