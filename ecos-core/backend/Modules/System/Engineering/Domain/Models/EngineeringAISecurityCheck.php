<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringAISecurityCheck extends Model
{
    public $timestamps = false;
    protected $table = 'engineering_ai_security_checks';
    protected $fillable = [
        'review_id', 'check_name', 'category', 'passed', 'severity', 'details', 'remediation',
    ];
    protected function casts(): array
    {
        return [
            'passed'     => 'boolean',
            'created_at' => 'datetime',
        ];
    }
    protected $dates = ['created_at'];
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
}
