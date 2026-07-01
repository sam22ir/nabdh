import { describe, expect, test, vi } from 'vitest';
import { shouldSuppressConvexLogLine, convexLogger } from './convexLogger';

describe('convexLogger', () => {
  test('suppresses expected password auth form failures', () => {
    expect(
      shouldSuppressConvexLogLine('error', [
        '[CONVEX A(auth:signIn)] [Request ID: abc] Server Error\nUncaught Error: InvalidSecret',
      ]),
    ).toBe(true);

    expect(
      shouldSuppressConvexLogLine('error', [
        '[CONVEX A(auth:signIn)] [Request ID: abc] Server Error\nUncaught Error: Invalid credentials',
      ]),
    ).toBe(true);
  });

  test('does not suppress unrelated Convex errors', () => {
    expect(
      shouldSuppressConvexLogLine('error', [
        '[CONVEX M(bookings:create)] Server Error\nUncaught Error: Clinic not found',
      ]),
    ).toBe(false);
  });

  test('keeps non-auth errors routed to console error', () => {
    const originalError = console.error;
    const errorSpy = vi.fn();
    console.error = errorSpy;
    try {
      convexLogger.error('[CONVEX M(bookings:create)] boom');
    } finally {
      console.error = originalError;
    }

    expect(errorSpy).toHaveBeenCalledWith('[CONVEX M(bookings:create)] boom');
  });
});
