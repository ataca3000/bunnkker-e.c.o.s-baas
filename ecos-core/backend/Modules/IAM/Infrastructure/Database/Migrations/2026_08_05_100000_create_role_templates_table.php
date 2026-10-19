<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-003 / ADR-039 — Enterprise Role Templates.
 * The canonical, versioned job-profile library. Additive; no existing table touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('role_templates')) {
            return;
        }

        Schema::create('role_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key')->unique();                 // stable slug, e.g. 'warehouse-clerk'
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 32)->index();         // RoleCategory value
            $table->string('status', 20)->default('published')->index();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_system')->default(false)->index();
            $table->boolean('is_composable')->default(true);
            $table->json('definition');                       // permissions/visibility/scope/policy/nav/dashboard/landing/preferences
            $table->uuid('role_id')->nullable()->index();    // compiled runtime role (roles.id)
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_templates');
    }
};
