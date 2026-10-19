<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class EngineeringReleasePackage extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_packages';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','package_type','file_path','file_size_bytes','checksum','manifest','metadata_payload','status','built_at','expires_at'];
    protected function casts(): array { return ['manifest' => 'array', 'metadata_payload' => 'array', 'file_size_bytes' => 'integer', 'built_at' => 'datetime', 'expires_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
