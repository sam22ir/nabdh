type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type ConvexLogger = {
  logVerbose(...args: unknown[]): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

const EXPECTED_PASSWORD_AUTH_FAILURES = [
  'InvalidSecret',
  'Invalid credentials',
  'already exists',
] as const;

export function shouldSuppressConvexLogLine(level: LogLevel, args: unknown[]) {
  if (level !== 'error') return false;

  const message = args.map((arg) => String(arg)).join(' ');
  return (
    message.includes('[CONVEX A(auth:signIn)]') &&
    EXPECTED_PASSWORD_AUTH_FAILURES.some((failure) =>
      message.includes(failure),
    )
  );
}

export const convexLogger: ConvexLogger = {
  logVerbose(...args: unknown[]) {
    console.debug(...args);
  },
  log(...args: unknown[]) {
    console.log(...args);
  },
  warn(...args: unknown[]) {
    console.warn(...args);
  },
  error(...args: unknown[]) {
    if (shouldSuppressConvexLogLine('error', args)) return;
    console.error(...args);
  },
};
