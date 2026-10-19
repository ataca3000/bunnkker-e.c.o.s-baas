<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Shared\Domain\Enums\TransactionType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

use const DATE_ATOM;

/**
 * Immutable value object representing a single explicit cash movement in a drawer.
 *
 * Only CashIn and CashOut movements are stored here.
 * Opening float and closing count are tracked separately on the CashDrawer aggregate.
 */
final readonly class CashMovement
{
    public function __construct(
        public string $id,
        public TransactionType $type,
        public Money $amount,
        public ?string $note,
        public string $recordedAt,  // ISO 8601 UTC
    ) {}

    public static function record(TransactionType $type, Money $amount, ?string $note = null): self
    {
        if (! $amount->isPositive()) {
            throw new InvalidArgumentException('Cash movement amount must be positive.');
        }

        return new self(
            id: self::generateUuid(),
            type: $type,
            amount: $amount,
            note: $note,
            recordedAt: (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DATE_ATOM),
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'amount' => $this->amount->toArray(),
            'note' => $this->note,
            'recorded_at' => $this->recordedAt,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            id: $data['id'],
            type: TransactionType::from($data['type']),
            amount: Money::fromArray($data['amount']),
            note: $data['note'],
            recordedAt: $data['recorded_at'],
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
