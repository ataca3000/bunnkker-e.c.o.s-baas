export function shouldApplyCatalogSnapshot<T>(
    productsAtRequestStart: readonly T[],
    currentProducts: readonly T[],
    mutationsInFlight: number
): boolean {
    return productsAtRequestStart === currentProducts && mutationsInFlight === 0;
}
