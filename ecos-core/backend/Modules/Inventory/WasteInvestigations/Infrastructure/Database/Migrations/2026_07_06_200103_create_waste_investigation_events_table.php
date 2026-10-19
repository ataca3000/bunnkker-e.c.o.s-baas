<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Combined timeline + audit log table.
     *
     * event_type values (extensible):
     *   created | resolved | attachment_added | attachment_removed
     *   notes_edited | damage_reason_changed | outcome_decided
     *   liability_created | value_changed
     */
    public function up(): void
    {
        if (Schema::hasTable('waste_investigation_events')) {
            return;
        }

        Schema::create('waste_investigation_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('investigation_id');

            $table->string('event_type', 60);
            $table->string('performed_by', 255)->nullable();
            $table->text('description')->nullable();
            $table->json('changes')->nullable(); // {field: {from: x, to: y}}
            $table->timestamp('occurred_at');

            $table->timestamps();

            $table->index('investigation_id');
            $table->index(['investigation_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_investigation_events');
    }
};
