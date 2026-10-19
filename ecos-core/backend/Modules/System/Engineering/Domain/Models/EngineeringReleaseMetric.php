<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class EngineeringReleaseMetric extends Model {
    protected $table = 'engineering_release_metrics';
    public $timestamps = false;
    protected $fillable = ['company_id','release_id','metric_type','metric_key','value','unit','breakdown','recorded_at'];
    protected function casts(): array { return ['value' => 'float', 'breakdown' => 'array', 'recorded_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
