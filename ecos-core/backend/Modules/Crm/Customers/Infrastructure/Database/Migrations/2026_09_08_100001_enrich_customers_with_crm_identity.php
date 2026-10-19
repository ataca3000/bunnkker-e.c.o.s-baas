<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Enrich the existing customer master.
 *
 * ┌─ ADDITIVE COLUMNS ON `customers` · ZERO BREAKING CHANGES ───────────────┐
 * │ The `customers` table already exists and is referenced (with real FKs by  │
 * │ orders, and as opaque UUIDs by Finance/POS/CustomerEngagement). We only    │
 * │ ADD identity columns it lacks — individual vs business, a richer status,   │
 * │ group, preferences and the merge linkage — every one guarded and           │
 * │ nullable/defaulted so nothing existing breaks. The legacy `name`,          │
 * │ `is_active`, `phone`, `email` columns are preserved and kept in sync.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    /** @var array<string, callable> */
    private function columns(): array
    {
        return [
            'customer_type' => fn (Blueprint $t) => $t->string('customer_type', 20)->default('individual')->after('name'),
            'first_name' => fn (Blueprint $t) => $t->string('first_name', 120)->nullable()->after('customer_type'),
            'last_name' => fn (Blueprint $t) => $t->string('last_name', 120)->nullable()->after('first_name'),
            'business_name' => fn (Blueprint $t) => $t->string('business_name', 200)->nullable()->after('last_name'),
            'tax_registration_number' => fn (Blueprint $t) => $t->string('tax_registration_number', 60)->nullable()->after('business_name'),
            'status' => fn (Blueprint $t) => $t->string('status', 20)->default('active')->after('is_active'),
            'customer_group_id' => fn (Blueprint $t) => $t->uuid('customer_group_id')->nullable()->after('status'),
            'preferred_language' => fn (Blueprint $t) => $t->string('preferred_language', 10)->nullable()->after('customer_group_id'),
            'preferred_contact_method' => fn (Blueprint $t) => $t->string('preferred_contact_method', 20)->nullable()->after('preferred_language'),
            'merged_into_id' => fn (Blueprint $t) => $t->uuid('merged_into_id')->nullable()->after('preferred_contact_method'),
            'archived_at' => fn (Blueprint $t) => $t->timestamp('archived_at')->nullable()->after('merged_into_id'),
            'archived_by' => fn (Blueprint $t) => $t->unsignedBigInteger('archived_by')->nullable()->after('archived_at'),
        ];
    }

    public function up(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            foreach ($this->columns() as $name => $add) {
                if (! Schema::hasColumn('customers', $name)) {
                    $add($table);
                }
            }
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->index('status', 'customers_status_idx');
            $table->index('customer_group_id', 'customers_group_idx');
            $table->index('merged_into_id', 'customers_merged_into_idx');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table): void {
            foreach (array_keys($this->columns()) as $name) {
                if (Schema::hasColumn('customers', $name)) {
                    $table->dropColumn($name);
                }
            }
        });
    }
};
