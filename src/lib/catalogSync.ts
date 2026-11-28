export function shouldApplyCatalogSnapshot<T>(
    productsAtRequestStart: readonly T[],
    currentProducts: readonly T[],
    mutationsInFlight: number
): boolean {
    return productsAtRequestStart === currentProducts && mutationsInFlight === 0;
}

export function acquireGlobalMutationLock(): void {
    if (typeof window === 'undefined') return;
    const lock = (window as unknown as Record<string, { current: number } | undefined>).__bunkkerMutationLock;
    if (lock) lock.current += 1;
}

export function releaseGlobalMutationLock(): void {
    if (typeof window === 'undefined') return;
    const lock = (window as unknown as Record<string, { current: number } | undefined>).__bunkkerMutationLock;
    if (lock) lock.current = Math.max(0, lock.current - 1);
}

