<?php

declare(strict_types=1);

namespace App\Contracts;

/**
 * Contract for immutable Data Transfer Objects (DTOs).
 *
 * DTOs carry structured, read-only data between layers without behavior. The
 * framework provides {@see \App\Core\DTO\BaseDTO} as a reusable base that
 * implements array conversion and JSON serialization via reflection.
 */
interface DTOInterface
{
    /**
     * Convert the DTO to an associative array.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array;

    /**
     * Convert the DTO to its JSON string representation.
     *
     * @param  int  $options  Bitmask of json_encode() options.
     */
    public function toJson(int $options = 0): string;
}
