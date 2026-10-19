<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('preparation_exceptions', 'issue_type')) {
            return;
        }

        Schema::table('preparation_exceptions', function (Blueprint $table): void {
            // Typed enum column alongside legacy free-text exception_type for backward compat.
            $table->string('issue_type', 50)->nullable()->after('exception_type');
            $table->uuid('raised_by')->nullable()->after('entity_id');
            $table->timestampTz('raised_at')->nullable()->after('raised_by');
            $table->index('issue_type', 'idx_prep_exceptions_issue_type');
        });
    }

    public function down(): void
    {
        Schema::table('preparation_exceptions', function (Blueprint $table): void {
            $table->dropIndex('idx_prep_exceptions_issue_type');
            $table->dropColumn(['issue_type', 'raised_by', 'raised_at']);
        });
    }
};
