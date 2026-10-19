<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class DeviceFingerprint
{
    private const MAX_LENGTH = 255;

    public function __construct(public string $value)
    {
        if (trim($this->value) === '') {
            throw new InvalidArgumentException('Device fingerprint cannot be empty.');
        }

        if (strlen($this->value) > self::MAX_LENGTH) {
            throw new InvalidArgumentException(
                sprintf('Device fingerprint exceeds maximum length of %d characters.', self::MAX_LENGTH),
            );
        }
    }

    public static function of(string $value): self
    {
        return new self(trim($value));
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
