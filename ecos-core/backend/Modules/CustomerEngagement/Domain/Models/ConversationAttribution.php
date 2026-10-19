<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ConversationAttribution extends Model
{
    use HasUuids;

    protected $table = 'cep_attribution';

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'raw_payload' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function conversation(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
