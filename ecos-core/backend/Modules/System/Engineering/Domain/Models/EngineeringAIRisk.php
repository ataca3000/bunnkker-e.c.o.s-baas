<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\RiskSeverity;

class EngineeringAIRisk extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $table = 'engineering_ai_risks';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'review_id', 'company_id', 'severity', 'category', 'title', 'description',
        'impact', 'recommendation', 'priority', 'is_blocking', 'is_acknowledged',
        'acknowledged_by', 'acknowledged_at', 'evidence',
    ];
    protected function casts(): array
    {
        return [
            'severity'        => RiskSeverity::class,
            'is_blocking'     => 'boolean',
            'is_acknowledged' => 'boolean',
            'evidence'        => 'array',
            'acknowledged_at' => 'datetime',
            'created_at'      => 'datetime',
        ];
    }
    protected $dates = ['created_at'];
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
}
