<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_cluster_events')) {
            return;
        }

        Schema::create('engineering_cluster_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->string('event_type', 100);
            $table->string('severity', 20)->default('info');
            $table->text('message');
            $table->json('context')->nullable();
            $table->timestamp('occurred_at');

            $table->index(['company_id', 'event_type', 'occurred_at'], 'eng_cluster_events_cid_type_time_idx');
            $table->index(['company_id', 'severity', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_cluster_events');
    }
};
