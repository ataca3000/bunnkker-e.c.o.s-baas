export type InventoryProductInput = {
    stock?: unknown;
    price?: unknown;
};

export type InventorySummary = {
    totalProductValue: number;
    productCount: number;
    totalUnits: number;
    inStockCount: number;
    outOfStockCount: number;
};

function toNonNegativeNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
}

function roundCurrencyCents(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateProductValue(product: InventoryProductInput): number {
    const stock = toNonNegativeNumber(product?.stock);
    const price = toNonNegativeNumber(product?.price);
    return roundCurrencyCents(stock * price);
}

export function calculateTotalProductValue(products: ReadonlyArray<InventoryProductInput>): number {
    if (!Array.isArray(products) || products.length === 0) return 0;

    let total = 0;
    for (const product of products) {
        const stock = toNonNegativeNumber(product?.stock);
        const price = toNonNegativeNumber(product?.price);
        total += stock * price;
    }

    return roundCurrencyCents(total);
}

export function calculateInventorySummary(products: ReadonlyArray<InventoryProductInput>): InventorySummary {
    if (!Array.isArray(products) || products.length === 0) {
        return {
            totalProductValue: 0,
            productCount: 0,
            totalUnits: 0,
            inStockCount: 0,
            outOfStockCount: 0,
        };
    }

    let totalValue = 0;
    let totalUnits = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;

    for (const product of products) {
        const stock = toNonNegativeNumber(product?.stock);
        const price = toNonNegativeNumber(product?.price);

        totalValue += stock * price;
        totalUnits += stock;

        if (stock > 0) {
            inStockCount += 1;
        } else {
            outOfStockCount += 1;
        }
    }

    return {
        totalProductValue: roundCurrencyCents(totalValue),
        productCount: products.length,
        totalUnits: roundCurrencyCents(totalUnits),
        inStockCount,
        outOfStockCount,
    };
}
