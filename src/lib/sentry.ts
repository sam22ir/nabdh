import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';
import type { PublicAuthRole } from './roleSelection';

type AuthExceptionContext = {
  flow: 'google-sign-in' | 'onboarding';
  role?: PublicAuthRole | 'none';
};

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
let sentryInitialized = false;

export function initSentry(): void {
  if (sentryInitialized || !sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
  sentryInitialized = true;
}

export function wrapWithSentry<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  initSentry();
  if (!sentryDsn) return Component;
  return Sentry.wrap(
    Component as ComponentType<Record<string, unknown>>,
  ) as ComponentType<P>;
}

export function captureAuthException(
  error: unknown,
  context: AuthExceptionContext,
): void {
  if (!sentryInitialized) return;

  Sentry.withScope((scope) => {
    scope.setTag('auth.flow', context.flow);
    if (context.role) {
      scope.setTag('auth.role', context.role);
    }
    Sentry.captureException(error);
  });
}
