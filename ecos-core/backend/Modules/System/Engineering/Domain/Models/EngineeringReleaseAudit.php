<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class EngineeringReleaseAudit extends Model {
    protected $table = 'engineering_release_audit';
    public $timestamps = false;
    protected $fillable = ['company_id','release_id','event_type','actor_id','actor_name','from_status','to_status','description','payload','ip_address','occurred_at'];
    protected function casts(): array { return ['payload' => 'array', 'occurred_at' => 'datetime']; }
    public function release(): BelongsTo { return $this->belongsTo(EngineeringRelease::class, 'release_id'); }
}
