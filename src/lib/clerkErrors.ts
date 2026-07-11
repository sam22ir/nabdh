type ClerkErrorLike = {
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  message?: string;
};

type ClerkSignUpStateLike = {
  status?: string | null;
  requiredFields?: string[];
  missingFields?: string[];
  unverifiedFields?: string[];
};

export function isClerkIdentifierExistsError(error: unknown): boolean {
  const clerkError = error as ClerkErrorLike;
  const errors = clerkError.errors ?? [];
  if (
    errors.some((entry) => {
      const code = entry.code?.toLowerCase() ?? '';
      const message = `${entry.message ?? ''} ${entry.longMessage ?? ''}`.toLowerCase();
      return code.includes('exist') || message.includes('exist');
    })
  ) {
    return true;
  }

  return (clerkError.message ?? '').toLowerCase().includes('already exists');
}

export function isClerkWeakPasswordError(error: unknown): boolean {
  const clerkError = error as ClerkErrorLike;
  const errors = clerkError.errors ?? [];
  if (
    errors.some((entry) => {
      const code = entry.code?.toLowerCase() ?? '';
      const message = `${entry.message ?? ''} ${entry.longMessage ?? ''}`.toLowerCase();
      return code.includes('password') && message.includes('strong');
    })
  ) {
    return true;
  }

  const message = (clerkError.message ?? '').toLowerCase();
  return message.includes('password') && message.includes('strong');
}

export function describeClerkSignUpState(signUpState: unknown): string {
  const state = signUpState as ClerkSignUpStateLike;
  return JSON.stringify({
    status: state.status ?? null,
    requiredFields: state.requiredFields ?? [],
    missingFields: state.missingFields ?? [],
    unverifiedFields: state.unverifiedFields ?? [],
  });
}
