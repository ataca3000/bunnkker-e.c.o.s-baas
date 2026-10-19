<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\ValueObjects;

/**
 * Immutable diff between two role profiles across every dimension (ADR-039).
 * Each dimension reports what the RIGHT profile adds vs the LEFT, and what it removes.
 */
final class RoleTemplateDiff
{
    /**
     * @param  array<string,array{added:list<string>,removed:list<string>}>  $listDimensions
     * @param  array<string,array{changed:array<string,array{from:mixed,to:mixed}>}>  $mapDimensions
     */
    private function __construct(
        public readonly string $left,
        public readonly string $right,
        public readonly array $listDimensions,
        public readonly array $mapDimensions,
    ) {}

    public static function between(string $left, string $right, EffectiveRoleProfile $a, EffectiveRoleProfile $b): self
    {
        $listDiff = static fn (array $from, array $to): array => [
            'added' => array_values(array_diff($to, $from)),
            'removed' => array_values(array_diff($from, $to)),
        ];

        $mapDiff = static function (array $from, array $to): array {
            $changed = [];
            foreach ($to as $key => $value) {
                $before = $from[$key] ?? null;
                if ($before !== $value) {
                    $changed[$key] = ['from' => $before, 'to' => $value];
                }
            }
            foreach ($from as $key => $value) {
                if (! array_key_exists($key, $to)) {
                    $changed[$key] = ['from' => $value, 'to' => null];
                }
            }

            return ['changed' => $changed];
        };

        return new self(
            left: $left,
            right: $right,
            listDimensions: [
                'permissions' => $listDiff($a->permissions, $b->permissions),
                'hidden_fields' => $listDiff($a->hiddenFields, $b->hiddenFields),
                'policies' => $listDiff($a->policies, $b->policies),
                'navigation' => $listDiff($a->navigation, $b->navigation),
            ],
            mapDimensions: [
                'scopes' => $mapDiff($a->scopes, $b->scopes),
            ],
        );
    }

    public function isIdentical(): bool
    {
        foreach ($this->listDimensions as $dim) {
            if ($dim['added'] !== [] || $dim['removed'] !== []) {
                return false;
            }
        }
        foreach ($this->mapDimensions as $dim) {
            if ($dim['changed'] !== []) {
                return false;
            }
        }

        return true;
    }

    /** @return array<string,mixed> */
    public function toArray(): array
    {
        return [
            'left' => $this->left,
            'right' => $this->right,
            'identical' => $this->isIdentical(),
            'lists' => $this->listDimensions,
            'maps' => $this->mapDimensions,
        ];
    }
}
