<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringAIRecommendation extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $table = 'engineering_ai_recommendations';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'review_id', 'company_id', 'type', 'priority', 'category', 'title',
        'description', 'effort_estimate', 'is_resolved', 'resolved_by', 'resolved_at',
    ];
    protected function casts(): array
    {
        return [
            'is_resolved' => 'boolean',
            'resolved_at' => 'datetime',
            'created_at'  => 'datetime',
        ];
    }
    protected $dates = ['created_at'];
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
}
