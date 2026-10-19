<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class EngineeringReleaseArtifact extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_artifacts';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','task_id','artifact_type','name','file_path','file_size_bytes','checksum','mime_type','metadata','uploaded_by'];
    protected function casts(): array { return ['metadata' => 'array', 'file_size_bytes' => 'integer']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
