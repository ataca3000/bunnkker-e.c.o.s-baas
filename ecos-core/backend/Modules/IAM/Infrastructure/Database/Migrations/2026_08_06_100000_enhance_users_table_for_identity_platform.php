<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-004 / ADR-040 — extend the users table for the Enterprise User Management
 * Platform. Purely ADDITIVE: only new nullable columns + SoftDeletes. The bigint
 * users.id primary key is untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Lifecycle
            if (! Schema::hasColumn('users', 'status')) {
                $table->string('status', 32)->default('active')->index()->after('email');
            }
            // Identity
            if (! Schema::hasColumn('users', 'employee_number')) {
                $table->string('employee_number')->nullable()->unique()->after('status');
            }
            if (! Schema::hasColumn('users', 'username')) {
                $table->string('username')->nullable()->unique()->after('employee_number');
            }
            if (! Schema::hasColumn('users', 'display_name')) {
                $table->string('display_name')->nullable()->after('name');
            }
            if (! Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('display_name');
            }
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 40)->nullable()->after('email');
            }
            // Preferences
            foreach ([
                'locale' => 8, 'timezone' => 64, 'date_format' => 32,
                'number_format' => 32, 'currency_preference' => 8,
            ] as $col => $len) {
                if (! Schema::hasColumn('users', $col)) {
                    $table->string($col, $len)->nullable();
                }
            }
            if (! Schema::hasColumn('users', 'signature')) {
                $table->text('signature')->nullable();
            }
            if (! Schema::hasColumn('users', 'notes')) {
                $table->text('notes')->nullable();
            }
            // Employment (HR-forward)
            if (! Schema::hasColumn('users', 'job_title')) {
                $table->string('job_title')->nullable();
            }
            if (! Schema::hasColumn('users', 'employment_type')) {
                $table->string('employment_type', 40)->nullable();
            }
            if (! Schema::hasColumn('users', 'manager_id')) {
                $table->unsignedBigInteger('manager_id')->nullable()->index();
            }
            if (! Schema::hasColumn('users', 'hire_date')) {
                $table->date('hire_date')->nullable();
            }
            if (! Schema::hasColumn('users', 'termination_date')) {
                $table->date('termination_date')->nullable();
            }
            // Security
            if (! Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'password_changed_at')) {
                $table->timestamp('password_changed_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'require_password_change')) {
                $table->boolean('require_password_change')->default(false);
            }
            if (! Schema::hasColumn('users', 'failed_login_count')) {
                $table->unsignedInteger('failed_login_count')->default(0);
            }
            foreach (['locked_at', 'suspended_at', 'archived_at', 'invited_at', 'activated_at'] as $ts) {
                if (! Schema::hasColumn('users', $ts)) {
                    $table->timestamp($ts)->nullable();
                }
            }
            if (! Schema::hasColumn('users', 'invited_by')) {
                $table->unsignedBigInteger('invited_by')->nullable();
            }
            if (! Schema::hasColumn('users', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable();
            }
            // Soft deletes
            if (! Schema::hasColumn('users', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach ([
                'status', 'employee_number', 'username', 'display_name', 'avatar_path', 'phone',
                'locale', 'timezone', 'date_format', 'number_format', 'currency_preference',
                'signature', 'notes', 'job_title', 'employment_type', 'manager_id', 'hire_date',
                'termination_date', 'last_login_at', 'last_activity_at', 'password_changed_at',
                'require_password_change', 'failed_login_count', 'locked_at', 'suspended_at',
                'archived_at', 'invited_at', 'activated_at', 'invited_by', 'created_by', 'deleted_at',
            ] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
