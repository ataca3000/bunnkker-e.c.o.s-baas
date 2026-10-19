<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * A declarative auto-matching rule. When a statement line is tested the engine
 * tries each active rule in priority order; the first whose predicate matches
 * proposes the book counterpart. Manual reconciliation ignores rules entirely.
 */
class BankReconciliationRule extends Model
{
    protected $table = 'finance_bank_reconciliation_rules';

    /** @var array<string, mixed> */
    protected $attributes = [
        'priority' => 100,
        'match_type' => 'contains',
        'match_field' => 'description',
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'bank_account_id', 'name', 'priority',
        'match_type', 'match_field', 'match_value', 'target_account_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'priority' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $rule): void {
            if ($rule->uuid === null) {
                $rule->uuid = (string) Str::uuid();
            }
        });
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function targetAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'target_account_id');
    }

    /**
     * Whether this rule matches a statement line. The predicate reads the chosen
     * field and applies the chosen comparison — a pure, side-effect-free test.
     */
    public function matches(BankStatementLine $line): bool
    {
        $field = match ($this->match_field) {
            'external_reference' => (string) $line->external_reference,
            'amount' => (string) $line->amount,
            default => (string) $line->description,
        };

        $needle = (string) $this->match_value;

        return match ($this->match_type) {
            'equals' => mb_strtolower(trim($field)) === mb_strtolower(trim($needle)),
            'regex' => @preg_match('/'.str_replace('/', '\/', $needle).'/i', $field) === 1,
            'amount' => abs((float) $field) === abs((float) $needle),
            default => $needle !== '' && mb_stripos($field, $needle) !== false,
        };
    }
}
