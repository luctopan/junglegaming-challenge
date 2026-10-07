/**
 * Exhaustiveness guard for discriminated unions: calling it in the `default`
 * branch of a `switch` makes the compiler reject any unhandled variant.
 */
export function assertNever(value: never, context = 'value'): never {
  throw new Error(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
