<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Domain\Enums;

enum WasteInvestigationOutcome: string
{
    case OperationalWaste = 'operational_waste';
    case WarehouseResponsibility = 'warehouse_responsibility';
    case SupplierResponsibility = 'supplier_responsibility';
    case PreparationResponsibility = 'preparation_responsibility';

    public function label(): string
    {
        return match ($this) {
            self::OperationalWaste => 'Operational Waste',
            self::WarehouseResponsibility => 'Warehouse Responsibility',
            self::SupplierResponsibility => 'Supplier Responsibility',
            self::PreparationResponsibility => 'Preparation Responsibility',
        };
    }

    public function createsWarehouseLiability(): bool
    {
        return $this === self::WarehouseResponsibility;
    }

    public function requiresInventoryDeduction(): bool
    {
        return $this === self::OperationalWaste || $this === self::WarehouseResponsibility;
    }
}
