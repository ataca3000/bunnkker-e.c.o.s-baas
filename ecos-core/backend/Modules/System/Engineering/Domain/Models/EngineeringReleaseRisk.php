<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\RiskLevel;
class EngineeringReleaseRisk extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_risks';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','risk_category','risk_title','risk_description','severity','likelihood','risk_score','mitigation_plan','is_accepted','accepted_by','accepted_at'];
    protected function casts(): array { return ['severity' => RiskLevel::class, 'is_accepted' => 'boolean', 'risk_score' => 'integer', 'accepted_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
