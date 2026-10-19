<?php

declare(strict_types=1);

namespace Modules\IAM\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for the login use case.
 */
final class LoginDTO extends BaseDTO
{
    public function __construct(
        public readonly string $email,
        public readonly string $password,
        public readonly bool $remember = false,
    ) {}

    /**
     * @param  array{email: string, password: string, remember?: bool}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            email: $data['email'],
            password: $data['password'],
            remember: (bool) ($data['remember'] ?? false),
        );
    }
}
