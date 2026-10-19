<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringAIArchitectureCheck extends Model
{
    public $timestamps = false;
    protected $table = 'engineering_ai_architecture_checks';
    protected $fillable = [
        'review_id', 'adr_reference', 'check_name', 'check_description',
        'passed', 'severity', 'details', 'evidence',
    ];
    protected function casts(): array
    {
        return [
            'passed'     => 'boolean',
            'evidence'   => 'array',
            'created_at' => 'datetime',
        ];
    }
    protected $dates = ['created_at'];
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
}
