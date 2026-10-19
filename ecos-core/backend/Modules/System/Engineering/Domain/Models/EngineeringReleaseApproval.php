<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\ApprovalStatus;
class EngineeringReleaseApproval extends Model {
    use HasUuids;
    protected $table = 'engineering_release_approvals';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['company_id','release_id','approval_level','approval_role','approver_id','status','comment','decision','sequence','is_required','requested_at','decided_at','expires_at'];
    protected function casts(): array { return ['status' => ApprovalStatus::class, 'is_required' => 'boolean', 'sequence' => 'integer', 'requested_at' => 'datetime', 'decided_at' => 'datetime', 'expires_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
