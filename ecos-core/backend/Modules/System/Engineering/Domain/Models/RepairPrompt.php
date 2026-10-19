<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RepairPrompt extends Model
{
    use HasUuids;

    protected $table = 'engineering_repair_prompts';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'company_id',
        'prompt_version',
        'prompt_type',
        'system_context',
        'repair_instructions',
        'context_files',
        'constraints',
        'success_criteria',
        'token_estimate',
        'is_active',
        'sent_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'context_files'    => 'array',
            'constraints'      => 'array',
            'success_criteria' => 'array',
            'prompt_version'   => 'integer',
            'token_estimate'   => 'integer',
            'is_active'        => 'boolean',
            'sent_at'          => 'datetime',
            'created_at'       => 'datetime',
        ];
    }

    // Relations

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(RepairResponse::class, 'prompt_id', 'id');
    }
}
