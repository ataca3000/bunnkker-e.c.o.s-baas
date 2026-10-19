<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_event_subscriptions')) {
            return;
        }

        Schema::create('automation_workflow_event_subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id')->index();
            $table->string('event_type', 100)->index();
            $table->string('entity_type', 50)->nullable();
            $table->json('filter_conditions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['workflow_id', 'event_type'], 'auto_evt_subs_wf_evt_uq');
        });

        DB::statement('CREATE INDEX auto_sub_event_active_idx ON automation_workflow_event_subscriptions (event_type, is_active)');
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_event_subscriptions');
    }
};
