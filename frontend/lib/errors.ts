/**
 * Normalises unknown thrown values into a user-safe error message.
 *
 * Use this in UI catch blocks so components stay focused on state transitions
 * instead of repeatedly spelling out `instanceof Error` fallback logic.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
