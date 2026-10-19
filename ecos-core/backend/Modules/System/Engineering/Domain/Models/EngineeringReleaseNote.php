<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class EngineeringReleaseNote extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_release_notes';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','note_type','section','content','is_public','is_pinned','authored_by'];
    protected function casts(): array { return ['is_public' => 'boolean', 'is_pinned' => 'boolean']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
