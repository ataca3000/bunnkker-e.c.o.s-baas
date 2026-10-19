<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cb_audit_log')) {
            return;
        }

        Schema::create('cb_audit_log', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id');
            $table->enum('actor_type', ['user', 'worker', 'system']);
            $table->uuid('actor_id');
            $table->string('actor_name', 255);
            $table->string('action', 100);
            $table->uuid('task_id')->nullable();
            $table->text('description');
            $table->timestamp('occurred_at');

            $table->index('company_id', 'idx_cb_audit_company');
            $table->index('task_id', 'idx_cb_audit_task');
            $table->index('occurred_at', 'idx_cb_audit_occurred');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cb_audit_log');
    }
};
