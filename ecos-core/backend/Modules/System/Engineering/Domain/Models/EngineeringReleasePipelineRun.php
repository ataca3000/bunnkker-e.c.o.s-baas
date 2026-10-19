<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class EngineeringReleasePipelineRun extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_pipeline_runs';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','pipeline_run_id','pipeline_type','status','trigger_type','triggered_by','pipeline_config','logs','result_payload','environment','exit_code','started_at','finished_at'];
    protected function casts(): array { return ['pipeline_config' => 'array', 'result_payload' => 'array', 'exit_code' => 'integer', 'started_at' => 'datetime', 'finished_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
    public function getDurationSecondsAttribute(): ?int {
        if (!$this->started_at || !$this->finished_at) { return null; }
        return $this->started_at->diffInSeconds($this->finished_at);
    }
}
