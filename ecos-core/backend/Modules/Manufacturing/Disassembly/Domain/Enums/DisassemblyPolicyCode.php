<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\Enums;

enum DisassemblyPolicyCode: string
{
    case Eligible = 'eligible';
    case ProductCannotDisassemble = 'product_cannot_disassemble';
    case RecipeNotFound = 'recipe_not_found';
    case ProductNotInventoryManaged = 'product_not_inventory_managed';
    case DisassemblyNotRequired = 'disassembly_not_required';
    case AlreadyDisassembled = 'already_disassembled';

    public function label(): string
    {
        return match ($this) {
            self::Eligible => 'Product is eligible for disassembly.',
            self::ProductCannotDisassemble => 'Product is not flagged for disassembly.',
            self::RecipeNotFound => 'No active recipe found for this product.',
            self::ProductNotInventoryManaged => 'Product is not inventory-managed.',
            self::DisassemblyNotRequired => 'Quantity is zero or negative.',
            self::AlreadyDisassembled => 'This trigger has already been disassembled.',
        };
    }
}
