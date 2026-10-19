<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\DTO;

/**
 * Immutable input DTO for creating / updating a Purchase Material request.
 */
final class PurchaseMaterialDTO
{
    /**
     * @param  list<PurchaseMaterialLineDTO>  $lines
     */
    public function __construct(
        public readonly string $warehouse_id,
        public readonly ?string $company_id,
        public readonly ?string $channel_id,
        public readonly string $priority,
        public readonly ?string $required_date,
        public readonly ?string $notes,
        public readonly array $lines,
        public readonly string $record_type = 'material_request',
        public readonly ?string $source_type = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $rawLines = is_array($data['lines'] ?? null) ? $data['lines'] : [];

        $lines = array_values(array_map(
            fn (mixed $line): PurchaseMaterialLineDTO => PurchaseMaterialLineDTO::fromArray((array) $line),
            $rawLines,
        ));

        return new self(
            warehouse_id: (string) ($data['warehouse_id'] ?? ''),
            company_id: self::nullStr($data, 'company_id'),
            channel_id: self::nullStr($data, 'channel_id'),
            priority: (string) ($data['priority'] ?? 'normal'),
            required_date: self::nullStr($data, 'required_date'),
            notes: self::nullStr($data, 'notes'),
            lines: $lines,
            record_type: (string) ($data['record_type'] ?? 'material_request'),
            source_type: self::nullStr($data, 'source_type'),
        );
    }

    /** @param array<string, mixed> $data */
    private static function nullStr(array $data, string $key): ?string
    {
        $v = $data[$key] ?? null;

        return $v === null || $v === '' ? null : (string) $v;
    }
}
