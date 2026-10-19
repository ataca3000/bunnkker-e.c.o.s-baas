<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class EngineeringReleaseDependency extends Model {
    use HasUuids;
    protected $table = 'engineering_release_dependencies';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','dependency_type','dependency_name','dependency_version','status','is_blocking','is_circular','resolution_notes','metadata'];
    protected function casts(): array { return ['is_blocking' => 'boolean', 'is_circular' => 'boolean', 'metadata' => 'array']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
