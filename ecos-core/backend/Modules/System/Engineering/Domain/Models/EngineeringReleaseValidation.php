<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\ValidationStatus;
class EngineeringReleaseValidation extends Model {
    protected $table = 'engineering_release_validation';
    protected $fillable = ['company_id','release_id','check_type','check_name','status','passed','message','details','score_contribution','severity','is_blocking','checked_at'];
    protected function casts(): array { return ['status' => ValidationStatus::class, 'passed' => 'boolean', 'is_blocking' => 'boolean', 'details' => 'array', 'score_contribution' => 'integer', 'checked_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
