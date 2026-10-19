<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->string('company_id', 36)->nullable()->index();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('action', 100)->index();
            $table->string('entity_type', 100)->index();
            $table->string('entity_id', 36)->index();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('config_version_id', 36)->nullable();
            $table->string('policy_version', 50)->nullable();
            $table->timestamp('occurred_at')->useCurrent();

            $table->index(['entity_type', 'entity_id'], 'idx_audit_entity');
            $table->index(['company_id', 'occurred_at'], 'idx_audit_company_time');
            $table->index(['user_id', 'occurred_at'], 'idx_audit_user_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
