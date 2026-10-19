<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('purchase_materials', 'review_notes')) {
            return;
        }

        Schema::table('purchase_materials', function (Blueprint $table): void {
            $table->text('review_notes')->nullable()->after('rejection_reason');
            $table->uuid('merged_into')->nullable()->after('review_notes')
                ->constrained('purchase_materials')->nullOnDelete();
            $table->timestamp('clarification_requested_at')->nullable()->after('merged_into');
            $table->uuid('clarification_requested_by')->nullable()->after('clarification_requested_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_materials', 'review_notes')) {
            return;
        }

        Schema::table('purchase_materials', function (Blueprint $table): void {
            $table->dropForeign(['merged_into']);
            $table->dropColumn([
                'review_notes', 'merged_into',
                'clarification_requested_at', 'clarification_requested_by',
            ]);
        });
    }
};
