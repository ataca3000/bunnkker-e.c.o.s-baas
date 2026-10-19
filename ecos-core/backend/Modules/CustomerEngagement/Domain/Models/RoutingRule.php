<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\CustomerEngagement\Domain\Enums\RoutingType;

class RoutingRule extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'cep_routing_rules';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'routing_type' => RoutingType::class,
            'conditions' => 'array',
            'is_active' => 'boolean',
            'apply_sla_policy' => 'boolean',
        ];
    }

    public function matches(array $conversationData): bool
    {
        foreach ($this->conditions as $condition) {
            $field = $condition['field'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $value = $condition['value'] ?? null;
            $actual = $conversationData[$field] ?? null;

            $match = match ($operator) {
                'equals' => $actual === $value,
                'not_equals' => $actual !== $value,
                'contains' => str_contains((string) $actual, (string) $value),
                'in' => in_array($actual, (array) $value),
                default => false,
            };

            if (! $match) {
                return false;
            }
        }

        return true;
    }
}
