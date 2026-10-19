<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-004 / ADR-040 — side tables for the User Management Platform.
 * All additive; keyed by the bigint users.id.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_organization_assignments')) {
            Schema::create('user_organization_assignments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->unsignedBigInteger('user_id');
                $table->string('org_type', 32);           // company/branch/warehouse/department/business_unit/region/channel/team/cost_center
                $table->string('org_id')->nullable();      // uuid string; nullable + string = forward-compatible for unit types with no table yet
                $table->string('org_label')->nullable();   // denormalised display label snapshot
                $table->boolean('is_primary')->default(false);
                $table->unsignedBigInteger('assigned_by')->nullable();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->unique(['user_id', 'org_type', 'org_id'], 'user_org_unique');
                $table->index(['org_type', 'org_id']);
            });
        }

        if (! Schema::hasTable('user_template_assignments')) {
            Schema::create('user_template_assignments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->unsignedBigInteger('user_id');
                $table->uuid('role_template_id');
                $table->boolean('is_primary')->default(false);
                $table->unsignedBigInteger('assigned_by')->nullable();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('role_template_id')->references('id')->on('role_templates')->cascadeOnDelete();
                $table->unique(['user_id', 'role_template_id'], 'user_template_unique');
            });
        }

        if (! Schema::hasTable('user_invitations')) {
            Schema::create('user_invitations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->unsignedBigInteger('user_id');
                $table->string('email');
                $table->string('token_hash', 128);         // store only the hash, never the raw token
                $table->string('status', 20)->default('pending'); // pending/accepted/expired/revoked
                $table->timestamp('expires_at')->nullable();
                $table->timestamp('accepted_at')->nullable();
                $table->unsignedBigInteger('invited_by')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->index(['user_id', 'status']);
                $table->index('token_hash');
            });
        }

        if (! Schema::hasTable('user_sessions')) {
            Schema::create('user_sessions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('token_id')->nullable(); // personal_access_tokens.id
                $table->string('ip_address', 64)->nullable();
                $table->string('user_agent', 512)->nullable();
                $table->string('browser', 64)->nullable();
                $table->string('platform', 64)->nullable();
                $table->timestamp('login_at')->nullable();
                $table->timestamp('last_activity_at')->nullable();
                $table->timestamp('revoked_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->index(['user_id', 'revoked_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('user_invitations');
        Schema::dropIfExists('user_template_assignments');
        Schema::dropIfExists('user_organization_assignments');
    }
};
