<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class EngineeringReleaseReport extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_reports';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','report_type','title','content','structured_data','format','generated_by','generated_at','is_final','version'];
    protected function casts(): array { return ['structured_data' => 'array', 'is_final' => 'boolean', 'generated_at' => 'datetime', 'version' => 'integer']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
