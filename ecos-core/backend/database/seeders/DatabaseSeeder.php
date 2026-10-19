<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Commerce\Channels\Infrastructure\Database\Seeders\ChannelSeeder;
use Modules\Commerce\Fulfillments\Infrastructure\Database\Seeders\FulfillmentSeeder;
use Modules\Commerce\Orders\Infrastructure\Database\Seeders\OrderSeeder;
use Modules\Commerce\ProductMappings\Infrastructure\Database\Seeders\ProductMappingSeeder;
use Modules\IAM\Infrastructure\Database\Seeders\RbacSeeder;
use Modules\IAM\Infrastructure\Database\Seeders\RoleTemplateSeeder;
use Modules\Inventory\Products\Infrastructure\Database\Seeders\ProductSeeder;
use Modules\Inventory\StockLedger\Infrastructure\Database\Seeders\StockLedgerSeeder;
use Modules\MasterData\Categories\Infrastructure\Database\Seeders\CategorySeeder;
use Modules\MasterData\Units\Infrastructure\Database\Seeders\UnitSeeder;
use Modules\MasterData\Warehouses\Infrastructure\Database\Seeders\WarehouseSeeder;
use Database\Seeders\EgyptMasterGeographySeeder;
use Modules\Organization\Branches\Infrastructure\Database\Seeders\BranchSeeder;
use Modules\Organization\Brands\Infrastructure\Database\Seeders\BrandSeeder;
use Modules\Organization\BusinessAccounts\Infrastructure\Database\Seeders\BusinessAccountSeeder;
use Modules\Organization\Companies\Infrastructure\Database\Seeders\CompanySeeder;
use Modules\Organization\Teams\Infrastructure\Database\Seeders\TeamSeeder;
use Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Seeders\GoodsReceiptSeeder;
use Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Seeders\PurchaseOrderSeeder;
use Modules\Purchasing\Suppliers\Infrastructure\Database\Seeders\SupplierSeeder;
use Modules\Sales\Customers\Infrastructure\Database\Seeders\CustomerSeeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // RBAC: roles and permissions must exist before any user is seeded.
        $this->call(RbacSeeder::class);

        // Enterprise Role Template Library — official job profiles (IAM-003 / ADR-039).
        $this->call(RoleTemplateSeeder::class);

        // Default administrator account (IAM-001).
        $this->call(AdminUserSeeder::class);

        // Master geography (Egypt 27 governorates + zones — must precede BranchSeeder).
        $this->call(EgyptMasterGeographySeeder::class);

        // Organization module (ORG-001 companies, ORG-002 branches, ORG-003 brands, ORG-004 teams).
        $this->call(CompanySeeder::class);
        $this->call(BranchSeeder::class);
        $this->call(BrandSeeder::class);
        $this->call(BusinessAccountSeeder::class);
        $this->call(TeamSeeder::class);

        // Master Data module (MD-001).
        $this->call(UnitSeeder::class);
        $this->call(CategorySeeder::class);
        $this->call(WarehouseSeeder::class);

        // Inventory module (PROD-001).
        $this->call(ProductSeeder::class);

        // Purchasing module (PUR-001, PUR-002).
        $this->call(SupplierSeeder::class);
        $this->call(PurchaseOrderSeeder::class);

        // Purchasing module (PUR-003).
        $this->call(GoodsReceiptSeeder::class);

        // Inventory module (INV-001 stock ledger).
        $this->call(StockLedgerSeeder::class);

        // Sales module (SAL-001 customers).
        $this->call(CustomerSeeder::class);

        // Commerce module (COM-001 channels).
        $this->call(ChannelSeeder::class);

        // Commerce module (COM-002 product mappings).
        $this->call(ProductMappingSeeder::class);

        // Commerce module (COM-005 orders).
        $this->call(OrderSeeder::class);

        // Commerce module (COM-007 fulfillments).
        $this->call(FulfillmentSeeder::class);
    }
}
