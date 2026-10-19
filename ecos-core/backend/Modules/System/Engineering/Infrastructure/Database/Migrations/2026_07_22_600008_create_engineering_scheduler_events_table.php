<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_scheduler_events')) {
            return;
        }

        Schema::create('engineering_scheduler_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->string('event_type', 100);
            $table->uuid('task_id')->nullable()->index();
            $table->uuid('worker_id')->nullable()->index();
            $table->string('policy', 50)->nullable();
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');

            $table->index(['company_id', 'event_type', 'occurred_at'], 'eng_sched_events_cid_type_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_scheduler_events');
    }
};
