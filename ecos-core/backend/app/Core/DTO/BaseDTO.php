<?php

declare(strict_types=1);

namespace App\Core\DTO;

use App\Contracts\DTOInterface;
use JsonSerializable;
use ReflectionClass;
use ReflectionProperty;

/**
 * Reusable, immutable base Data Transfer Object.
 *
 * Concrete DTOs extend this class and declare their fields as
 * `public readonly` constructor-promoted properties, which guarantees
 * immutable construction. This base provides:
 *
 *  - Array conversion ({@see BaseDTO::toArray()}), including nested DTOs/arrays.
 *  - JSON serialization ({@see BaseDTO::toJson()} and
 *    {@see JsonSerializable::jsonSerialize()}).
 *
 * It contains no business logic and is framework-agnostic.
 *
 * @example
 *  final class UserDTO extends BaseDTO
 *  {
 *      public function __construct(
 *          public readonly string $name,
 *          public readonly string $email,
 *      ) {}
 *  }
 */
abstract class BaseDTO implements DTOInterface, JsonSerializable
{
    /**
     * Convert the DTO (and any nested DTOs/arrays) to an associative array.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $result = [];

        foreach ($this->publicProperties() as $property) {
            $result[$property->getName()] = $this->normalize($property->getValue($this));
        }

        return $result;
    }

    /**
     * Convert the DTO to a JSON string.
     *
     * @param  int  $options  Bitmask of json_encode() options.
     */
    public function toJson(int $options = 0): string
    {
        return (string) json_encode($this->toArray(), $options | JSON_THROW_ON_ERROR);
    }

    /**
     * Data used when the DTO is passed to json_encode().
     *
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * Reflected list of the DTO's public properties.
     *
     * @return array<int, ReflectionProperty>
     */
    private function publicProperties(): array
    {
        return (new ReflectionClass($this))->getProperties(ReflectionProperty::IS_PUBLIC);
    }

    /**
     * Recursively normalize a value for array/JSON output.
     */
    private function normalize(mixed $value): mixed
    {
        if ($value instanceof DTOInterface) {
            return $value->toArray();
        }

        if (is_array($value)) {
            return array_map(fn (mixed $item): mixed => $this->normalize($item), $value);
        }

        return $value;
    }
}
