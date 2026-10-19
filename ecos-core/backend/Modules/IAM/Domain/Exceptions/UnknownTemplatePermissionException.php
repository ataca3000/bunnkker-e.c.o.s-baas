<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use RuntimeException;

/**
 * A role template referenced a permission that does not exist in the seeded catalog.
 *
 * ┌─ WHY THIS EXISTS (BUG-GL-011 / TASK-IAM-HOTFIX-001) ─────────────────────┐
 * │ RoleTemplateCompiler used to call Permission::firstOrCreate() for every   │
 * │ token a template referenced. A typo, or a namespace the platform never    │
 * │ implemented, was therefore not an error — the compiler minted the row and │
 * │ granted it. The role then held a permission no module enforces, so the    │
 * │ user saw the module in their navigation and was refused by every screen   │
 * │ in it, with nothing anywhere reporting a problem.                          │
 * │                                                                            │
 * │ Four finance templates shipped that way against an `accounting.*`          │
 * │ namespace that has zero seeded permissions. It stayed invisible for as     │
 * │ long as no template was ever assigned.                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Permissions are now authored in one place — the permission catalog seeder —
 * and templates may only reference what it defines.
 */
final class UnknownTemplatePermissionException extends RuntimeException
{
    /**
     * @param  list<string>  $unknown  every unresolved permission name, not just the first
     */
    private function __construct(
        public readonly string $templateKey,
        public readonly array $unknown,
        string $message,
    ) {
        parent::__construct($message);
    }

    /**
     * @param  list<string>  $unknown
     */
    public static function forTemplate(string $templateKey, array $unknown): self
    {
        sort($unknown);

        $namespaces = array_values(array_unique(array_map(
            static fn (string $p): string => explode('.', $p)[0],
            $unknown,
        )));
        sort($namespaces);

        $lines = array_map(static fn (string $p): string => '  - '.$p, $unknown);

        $message = sprintf(
            "Role template [%s] references %d permission(s) that do not exist in the permission catalog.\n".
            "Namespace(s): %s\n%s\n".
            'Permissions are defined by the catalog seeder, never by the compiler. '.
            'Either correct the template to use an existing permission, or seed the missing permission first.',
            $templateKey,
            count($unknown),
            implode(', ', $namespaces),
            implode("\n", $lines),
        );

        return new self($templateKey, $unknown, $message);
    }
}
