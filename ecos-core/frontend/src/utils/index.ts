/**
 * Small, generic, framework-agnostic helpers. No business logic.
 */

/** Resolve after the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Type guard filtering out `null` and `undefined`. */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
