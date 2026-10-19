<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Modules\IAM\Domain\Enums\UserStatus;
use Modules\IAM\Domain\Models\UserInvitation;
use Modules\IAM\Domain\Models\UserOrganizationAssignment;
use Modules\IAM\Domain\Models\UserSession;
use Modules\IAM\Domain\Models\UserTemplateAssignment;
use Modules\IAM\Domain\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * Identity/profile/employment fields are mass-assignable; SECURITY-SENSITIVE fields
     * (status, failed_login_count, locked_at, …) are intentionally EXCLUDED — they are
     * mutated only through the platform services (ADR-040, Decision 5).
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'company_id',
        // Identity
        'employee_number',
        'username',
        'display_name',
        'avatar_path',
        'phone',
        // Preferences
        'locale',
        'timezone',
        'date_format',
        'number_format',
        'currency_preference',
        'signature',
        'notes',
        // Employment
        'job_title',
        'employment_type',
        'manager_id',
        'hire_date',
        'termination_date',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'require_password_change' => 'boolean',
            'failed_login_count' => 'integer',
            'hire_date' => 'date',
            'termination_date' => 'date',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'password_changed_at' => 'datetime',
            'locked_at' => 'datetime',
            'suspended_at' => 'datetime',
            'archived_at' => 'datetime',
            'invited_at' => 'datetime',
            'activated_at' => 'datetime',
        ];
    }

    // ── Identity helpers ──────────────────────────────────────────────────────

    public function statusEnum(): UserStatus
    {
        return UserStatus::tryFrom((string) ($this->status ?? UserStatus::ACTIVE->value)) ?? UserStatus::ACTIVE;
    }

    public function isActive(): bool
    {
        return $this->statusEnum() === UserStatus::ACTIVE;
    }

    public function resolvedDisplayName(): string
    {
        return $this->display_name ?: $this->name ?: (string) $this->email;
    }

    // ── Relationships (all additive) ──────────────────────────────────────────

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function organizationAssignments(): HasMany
    {
        return $this->hasMany(UserOrganizationAssignment::class);
    }

    public function templateAssignments(): HasMany
    {
        return $this->hasMany(UserTemplateAssignment::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(UserInvitation::class);
    }

    public function platformSessions(): HasMany
    {
        return $this->hasMany(UserSession::class);
    }
}
