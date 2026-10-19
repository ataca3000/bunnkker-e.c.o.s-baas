<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One itemised component of a payslip.
 *
 * `sign` says whether the line adds to or subtracts from pay, and `source_type`
 * plus `source_id` point at the bonus, commission rule, advance installment or
 * deduction that produced it — so every figure traces back to its cause.
 */
class PayslipLine extends Model
{
    use HasUuids;

    protected $table = 'hr_payslip_lines';

    protected $fillable = [
        'payslip_id', 'category', 'code', 'label', 'amount', 'sign',
        'source_type', 'source_id', 'explanation', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'sign' => 'integer',
            'sequence' => 'integer',
            'explanation' => 'array',
        ];
    }

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class, 'payslip_id');
    }

    /** The line's contribution to the net, sign applied. */
    public function signedAmount(): float
    {
        return round((float) $this->amount * ($this->sign >= 0 ? 1 : -1), 2);
    }
}
